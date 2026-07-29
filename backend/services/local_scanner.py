import os
from pathlib import Path
from typing import Any

from sqlmodel import Session, select

from database import engine
from models.inventory import LocalInventory

SUPPORTED_EXTENSIONS = {".gguf", ".safetensors", ".bin", ".onnx", ".mlx", ".exl2"}

CAPABILITY_KEYWORDS = {
    "vision": "Vision",
    "coding": "Coding",
    "llm": "LLM",
    "text": "LLM",
    "chat": "LLM",
    "multimodal": "Vision",
    "image": "Vision",
    "code": "Coding",
}

FORMAT_BY_EXTENSION = {
    ".gguf": "GGUF",
    ".safetensors": "Safetensors",
    ".bin": "Pickled",
    ".onnx": "ONNX",
    ".mlx": "MLX",
    ".exl2": "EXL2",
}


def _detect_capability(file_path: Path) -> str:
    parts = [p.lower() for p in file_path.parts]
    matched: set[str] = set()
    for keyword, capability in CAPABILITY_KEYWORDS.items():
        if any(keyword in part for part in parts):
            matched.add(capability)
    if "Vision" in matched and "LLM" in matched:
        matched.discard("LLM")
    return ", ".join(sorted(matched)) if matched else "LLM"


def _detect_format(file_path: Path) -> str:
    ext = file_path.suffix.lower()
    return FORMAT_BY_EXTENSION.get(ext, ext.lstrip(".").upper() or "Unknown")


def _scan_path(path: Path) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    if path.is_file():
        if path.suffix.lower() in SUPPORTED_EXTENSIONS:
            stat = path.stat()
            results.append({
                "local_path": str(path.resolve()),
                "filename": path.name,
                "detected_format": _detect_format(path),
                "detected_capability": _detect_capability(path),
                "size_bytes": stat.st_size,
            })
        return results

    if path.is_dir():
        for root, _dirs, files in os.walk(path):
            for filename in files:
                file_path = Path(root) / filename
                if file_path.suffix.lower() in SUPPORTED_EXTENSIONS:
                    stat = file_path.stat()
                    results.append({
                        "local_path": str(file_path.resolve()),
                        "filename": file_path.name,
                        "detected_format": _detect_format(file_path),
                        "detected_capability": _detect_capability(file_path),
                        "size_bytes": stat.st_size,
                    })
    return results


def scan_folders(paths: list[str]) -> dict[str, Any]:
    discovered: list[dict[str, Any]] = []
    errors: list[str] = []

    for raw_path in paths:
        path = Path(raw_path).expanduser()
        if not path.exists():
            errors.append(f"Path does not exist: {raw_path}")
            continue
        try:
            discovered.extend(_scan_path(path))
        except Exception as e:
            errors.append(f"Error scanning {raw_path}: {e}")

    inserted_count = 0
    with Session(engine) as session:
        for item in discovered:
            existing = session.exec(
                select(LocalInventory).where(
                    LocalInventory.local_path == item["local_path"]
                )
            ).first()
            if existing:
                existing.detected_format = item["detected_format"]
                existing.detected_capability = item["detected_capability"]
                existing.size_bytes = item["size_bytes"]
                session.add(existing)
            else:
                session.add(LocalInventory(**item))
                inserted_count += 1
        session.commit()

    return {
        "scanned": len(paths),
        "discovered": len(discovered),
        "inserted": inserted_count,
        "errors": errors,
    }
