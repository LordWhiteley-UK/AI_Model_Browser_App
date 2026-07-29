import os
from pathlib import Path
from typing import Any

import httpx

DEFAULT_DOWNLOAD_DIR = Path.home() / "AI_Model_Browser_Downloads"


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def download_file(
    url: str,
    filename: str | None = None,
    destination: str | None = None,
    chunk_size: int = 8192,
) -> dict[str, Any]:
    dest_dir = Path(destination).expanduser() if destination else DEFAULT_DOWNLOAD_DIR
    _ensure_dir(dest_dir)

    out_filename = filename or url.split("/")[-1].split("?")[0] or "download.bin"
    out_path = dest_dir / out_filename

    headers: dict[str, str] = {}
    start_byte = 0
    if out_path.exists():
        start_byte = out_path.stat().st_size
        headers["Range"] = f"bytes={start_byte}-"

    with httpx.stream("GET", url, headers=headers, follow_redirects=True, timeout=60) as response:
        if response.status_code not in (200, 206):
            raise RuntimeError(f"Download failed: HTTP {response.status_code}")

        total = response.headers.get("Content-Length")
        total_bytes = int(total) + start_byte if total else None

        with open(out_path, "ab" if start_byte else "wb") as f:
            downloaded = start_byte
            for chunk in response.iter_bytes(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    downloaded += len(chunk)

    return {
        "url": url,
        "local_path": str(out_path.resolve()),
        "filename": out_filename,
        "size_bytes": downloaded,
        "resumed": start_byte > 0,
        "total_bytes": total_bytes,
    }
