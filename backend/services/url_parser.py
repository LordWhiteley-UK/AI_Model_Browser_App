import os
import re
from urllib.parse import urlparse

from huggingface_hub import HfApi, hf_hub_url

from providers.huggingface import (
    SUPPORTED_EXTENSIONS,
    _detect_format,
    _parse_quant_method,
)


def parse_huggingface_url(url: str) -> tuple[str, str | None]:
    """Return (repo_id, optional filename) from a Hugging Face URL."""
    parsed = urlparse(url.strip())
    path = parsed.path.strip("/")

    # https://huggingface.co/org/repo or /org/repo/resolve/main/file.gguf etc.
    patterns = [
        r"^([^/]+/[^/]+)/blob/[^/]+/(.+)$",
        r"^([^/]+/[^/]+)/resolve/[^/]+/(.+)$",
        r"^([^/]+/[^/]+)$",
    ]
    for pattern in patterns:
        match = re.match(pattern, path)
        if match:
            return match.group(1), match.group(2) if match.lastindex >= 2 else None
    raise ValueError("Unrecognised Hugging Face URL")


def list_files_from_url(url: str) -> dict:
    repo_id, filename = parse_huggingface_url(url)
    api = HfApi()
    info = api.model_info(repo_id, files_metadata=True)

    files = []
    for sibling in getattr(info, "siblings", []) or []:
        path = getattr(sibling, "rfilename", None)
        if not path or "/" in path:
            continue
        name = path.split("/")[-1]
        ext = os.path.splitext(name)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        if filename and name != filename:
            continue

        size = getattr(sibling, "size", 0) or 0
        files.append({
            "filename": name,
            "format": _detect_format(name, repo_id),
            "quant_method": _parse_quant_method(name),
            "size_bytes": size,
            "download_url": hf_hub_url(repo_id, filename=path, repo_type="model"),
            "estimated_vram_mb": round(size / (1024 ** 2) * 1.15, 2) if size else None,
        })

    if not files:
        raise ValueError("No supported model files found at that URL")

    return {
        "repo_id": repo_id,
        "family_id": repo_id,
        "files": files,
    }
