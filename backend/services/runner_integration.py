import asyncio
import shutil
import subprocess
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from database import engine
from models.runner_settings import RunnerPathOverride
from services.runner_detector import detect_lm_studio, detect_ollama


def _get_override(runner_id: str) -> dict[str, Any]:
    with Session(engine) as session:
        row = session.get(RunnerPathOverride, runner_id)
        if row:
            return {"binary_path": row.binary_path, "model_path": row.model_path}
    return {"binary_path": None, "model_path": None}


async def move_to_lm_studio(local_path: str, source_family_id: str | None) -> dict[str, Any]:
    runner = detect_lm_studio()
    override = _get_override("lm_studio")
    model_path = override.get("model_path") or runner.default_model_path

    if not model_path:
        raise RuntimeError("LM Studio model folder is not configured")

    src = Path(local_path)
    family = (source_family_id or "unknown/unknown").replace("_", "-").lower()
    if "/" not in family:
        family = f"unknown/{family}"
    publisher, repo = family.split("/", 1)

    dest_dir = Path(model_path).expanduser() / publisher / repo
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / src.name

    await asyncio.to_thread(shutil.move, str(src), str(dest))

    return {"runner": "lm_studio", "new_path": str(dest.resolve())}


async def import_to_ollama(local_path: str, model_name: str | None = None) -> dict[str, Any]:
    runner = detect_ollama()
    override = _get_override("ollama")
    binary_path = override.get("binary_path") or runner.binary_path

    if not binary_path:
        raise RuntimeError("Ollama binary is not detected or configured")

    src = Path(local_path)
    if src.suffix.lower() != ".gguf":
        raise RuntimeError("Ollama import only supports GGUF files")

    modelfile_path = src.with_suffix(".Modelfile")
    modelfile_path.write_text(f"FROM {src}\n")

    name = model_name or src.stem.lower().replace(" ", "-").replace("_", "-")

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(
                subprocess.run,
                [binary_path, "create", name, "-f", str(modelfile_path)],
                capture_output=True,
                text=True,
            ),
            timeout=300,
        )
        if result.returncode != 0:
            raise RuntimeError(result.stderr.strip() or "ollama create failed")
    except asyncio.TimeoutError:
        raise RuntimeError("ollama create timed out")

    return {"runner": "ollama", "model": name}
