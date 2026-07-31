from fastapi import Depends, FastAPI, HTTPException, Query
import subprocess
from typing import Literal
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session, init_db
from models.hardware import HardwareProfile
from models.inventory import LocalInventory
from providers.huggingface import HuggingFaceProvider
from seed import ensure_active_profile, seed_profiles
from services.compatibility_engine import score_compatibility
from services.download_queue import DownloadManager
from services.hardware_detector import detect_system_specs
from services.launcher import SUPPORTED_RUNNERS, build_launcher_command
from services.local_scanner import scan_folders
from services.runner_detector import apply_overrides, detect_all_runners, detect_ollama
from models.runner_settings import RunnerPathOverride

download_manager = DownloadManager()

app = FastAPI(title="AI Model Browser API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()
    seed_profiles()
    ensure_active_profile()


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "ai-model-browser-backend",
        "version": "0.1.0",
    }


@app.get("/api/hardware/profiles")
def list_profiles(session: Session = Depends(get_session)):
    profiles = session.exec(select(HardwareProfile)).all()
    return profiles


@app.get("/api/hardware/active")
def get_active_profile(session: Session = Depends(get_session)):
    profile = session.exec(
        select(HardwareProfile).where(HardwareProfile.is_active == True)
    ).first()
    if not profile:
        raise HTTPException(status_code=404, detail="No active hardware profile")
    return profile


@app.post("/api/hardware/active/{profile_id}")
def set_active_profile(profile_id: int, session: Session = Depends(get_session)):
    target = session.get(HardwareProfile, profile_id)
    if not target:
        raise HTTPException(status_code=404, detail="Profile not found")

    current = session.exec(
        select(HardwareProfile).where(HardwareProfile.is_active == True)
    ).all()
    for p in current:
        p.is_active = False
        session.add(p)

    target.is_active = True
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


@app.get("/api/hardware/system")
def get_system_specs():
    return detect_system_specs()


class ScanRequest(BaseModel):
    paths: list[str]


class CreateProfileRequest(BaseModel):
    name: str
    os: str
    cpu_name: str | None = None
    gpu_name: str | None = None
    ram_type: str | None = None
    total_ram_gb: float
    total_vram_gb: float = 0.0
    is_unified_memory: bool = False


class SetPreferredRunnerRequest(BaseModel):
    runner: str


@app.post("/api/hardware/profiles")
def create_profile(
    request: CreateProfileRequest, session: Session = Depends(get_session)
):
    existing = session.exec(
        select(HardwareProfile).where(HardwareProfile.name == request.name)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="A profile with this name already exists")

    profile = HardwareProfile(
        name=request.name,
        os=request.os,
        cpu_name=request.cpu_name,
        gpu_name=request.gpu_name,
        ram_type=request.ram_type,
        total_ram_gb=request.total_ram_gb,
        total_vram_gb=request.total_vram_gb,
        is_unified_memory=request.is_unified_memory,
    )
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


@app.delete("/api/hardware/profiles/{profile_id}")
def delete_profile(profile_id: int, session: Session = Depends(get_session)):
    profile = session.get(HardwareProfile, profile_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if profile.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete the active profile")
    session.delete(profile)
    session.commit()
    return {"deleted": True}


@app.post("/api/inventory/scan")
def scan_inventory(request: ScanRequest):
    if not request.paths:
        raise HTTPException(status_code=400, detail="No paths provided")
    return scan_folders(request.paths)


@app.get("/api/inventory")
def list_inventory(session: Session = Depends(get_session)):
    items = session.exec(
        select(LocalInventory).order_by(LocalInventory.added_at.desc())
    ).all()
    return items


@app.get("/api/inventory/{item_id}")
def get_inventory_item(item_id: int, session: Session = Depends(get_session)):
    item = session.get(LocalInventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


@app.post("/api/inventory/{item_id}/runner")
def set_preferred_runner(
    item_id: int,
    request: SetPreferredRunnerRequest,
    session: Session = Depends(get_session),
):
    item = session.get(LocalInventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    if request.runner not in SUPPORTED_RUNNERS:
        raise HTTPException(status_code=400, detail="Unsupported runner")
    item.preferred_runner = request.runner
    session.add(item)
    session.commit()
    session.refresh(item)
    return item


@app.get("/api/inventory/{item_id}/launch")
def get_launcher_options(item_id: int, session: Session = Depends(get_session)):
    item = session.get(LocalInventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    runners = []
    for key, value in SUPPORTED_RUNNERS.items():
        runner = build_launcher_command(key, item.local_path)
        runners.append({
            "id": key,
            "name": value,
            "is_preferred": item.preferred_runner == key,
            **runner,
        })
    return {
        "local_path": item.local_path,
        "filename": item.filename,
        "preferred_runner": item.preferred_runner,
        "runners": runners,
    }


@app.get("/api/discover/search")
def discover_search(
    query: str = Query(default=""),
    capability: str | None = Query(default=None),
    format: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
    sort: Literal["downloads", "trendingScore"] = Query(default="downloads"),
    session: Session = Depends(get_session),
):
    active_profile = session.exec(
        select(HardwareProfile).where(HardwareProfile.is_active == True)
    ).first()
    if not active_profile:
        raise HTTPException(status_code=404, detail="No active hardware profile")

    provider = HuggingFaceProvider()
    try:
        families = provider.search(
            query=query,
            capability=capability,
            format=format,
            limit=limit,
            sort=sort,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Hugging Face search failed: {e}")

    for family in families:
        for file in family.get("files", []):
            file["compatibility"] = score_compatibility(
                file.get("size_bytes", 0), active_profile
            )

    return {
        "query": query,
        "capability": capability,
        "format": format,
        "sort": sort,
        "count": len(families),
        "active_profile": {
            "id": active_profile.id,
            "name": active_profile.name,
            "total_ram_gb": active_profile.total_ram_gb,
            "total_vram_gb": active_profile.total_vram_gb,
            "is_unified_memory": active_profile.is_unified_memory,
        },
        "families": families,
    }


class DownloadRequest(BaseModel):
    url: str
    filename: str | None = None
    destination: str | None = None
    runner_target: str | None = None
    source_family_id: str | None = None


@app.post("/api/download")
async def download_model_file(request: DownloadRequest):
    try:
        job = await download_manager.start_download(
            url=request.url,
            filename=request.filename,
            destination=request.destination,
            runner_target=request.runner_target,
            source_family_id=request.source_family_id,
        )
        return job.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")


@app.post("/api/download/jobs")
async def create_download_job(request: DownloadRequest):
    try:
        job = await download_manager.start_download(
            url=request.url,
            filename=request.filename,
            destination=request.destination,
            runner_target=request.runner_target,
            source_family_id=request.source_family_id,
        )
        return job.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")


@app.get("/api/download/jobs")
def list_download_jobs():
    return {"jobs": [job.to_dict() for job in download_manager.list_jobs()]}


@app.get("/api/download/jobs/{job_id}")
def get_download_job(job_id: str):
    job = download_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found")
    return job.to_dict()


@app.post("/api/download/jobs/{job_id}/cancel")
async def cancel_download_job(job_id: str):
    job = await download_manager.cancel_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found")
    return job.to_dict()


@app.delete("/api/download/jobs/{job_id}")
def delete_download_job(job_id: str):
    job = download_manager.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Download job not found")
    del download_manager._jobs[job_id]
    return {"deleted": True}


@app.get("/api/runners")
def list_runners():
    return {"runners": SUPPORTED_RUNNERS}


@app.get("/api/runners/detected")
def get_detected_runners(session: Session = Depends(get_session)):
    runners = detect_all_runners()
    overrides = {
        row.runner_id: {
            "binary_path": row.binary_path,
            "model_path": row.model_path,
        }
        for row in session.exec(select(RunnerPathOverride)).all()
    }
    return {
        "runners": [
            runner.to_dict() for runner in apply_overrides(runners, overrides)
        ]
    }


class RunnerPathRequest(BaseModel):
    binary_path: str | None = None
    model_path: str | None = None


@app.put("/api/runners/settings/{runner_id}")
def update_runner_settings(
    runner_id: str,
    request: RunnerPathRequest,
    session: Session = Depends(get_session),
):
    override = session.get(RunnerPathOverride, runner_id)
    if not override:
        override = RunnerPathOverride(runner_id=runner_id)
    if request.binary_path is not None:
        override.binary_path = request.binary_path or None
    if request.model_path is not None:
        override.model_path = request.model_path or None
    session.add(override)
    session.commit()
    session.refresh(override)

    runners = detect_all_runners()
    overrides = {
        row.runner_id: {
            "binary_path": row.binary_path,
            "model_path": row.model_path,
        }
        for row in session.exec(select(RunnerPathOverride)).all()
    }
    updated = apply_overrides(runners, overrides)
    for runner in updated:
        if runner.id == runner_id:
            return runner.to_dict()
    raise HTTPException(status_code=404, detail="Runner not found")


@app.post("/api/runners/import-ollama/{inventory_item_id}")
async def import_to_ollama(
    inventory_item_id: int,
    model_name: str | None = None,
    session: Session = Depends(get_session),
):
    item = session.get(LocalInventory, inventory_item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    runner = detect_ollama()
    overrides = session.exec(
        select(RunnerPathOverride).where(RunnerPathOverride.runner_id == "ollama")
    ).first()
    if overrides and overrides.binary_path:
        runner.binary_path = overrides.binary_path
        runner.detected = True

    if not runner.detected or not runner.binary_path:
        raise HTTPException(status_code=400, detail="Ollama is not detected or configured")

    if not item.local_path.lower().endswith(".gguf"):
        raise HTTPException(status_code=400, detail="Ollama import only supports GGUF files")

    local_path = Path(item.local_path)
    modelfile_path = local_path.with_suffix(".Modelfile")
    modelfile_path.write_text(f"FROM {local_path}\n")

    name = model_name or local_path.stem.lower().replace(" ", "-").replace("_", "-")
    try:
        result = subprocess.run(
            [runner.binary_path, "create", name, "-f", str(modelfile_path)],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "ollama create failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama import failed: {e}")

    return {"imported": True, "runner": "ollama", "model": name}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
