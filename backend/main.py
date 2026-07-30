from fastapi import Depends, FastAPI, HTTPException, Query
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
from services.downloader import download_file
from services.hardware_detector import detect_system_specs
from services.launcher import SUPPORTED_RUNNERS, build_launcher_command
from services.local_scanner import scan_folders

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


@app.get("/api/inventory/{item_id}/launch")
def get_launcher_options(item_id: int, session: Session = Depends(get_session)):
    item = session.get(LocalInventory, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return {
        "local_path": item.local_path,
        "filename": item.filename,
        "runners": [
            {
                "id": key,
                "name": value,
                **build_launcher_command(key, item.local_path),
            }
            for key, value in SUPPORTED_RUNNERS.items()
        ],
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


@app.post("/api/download")
def download_model_file(request: DownloadRequest):
    try:
        return download_file(
            url=request.url,
            filename=request.filename,
            destination=request.destination,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Download failed: {e}")


@app.get("/api/runners")
def list_runners():
    return {"runners": SUPPORTED_RUNNERS}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
