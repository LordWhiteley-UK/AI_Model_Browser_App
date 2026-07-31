import asyncio
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx

DEFAULT_DOWNLOAD_DIR = Path.home() / "AI_Model_Browser_Downloads"


def _ensure_dir(path: Path) -> Path:
    path.mkdir(parents=True, exist_ok=True)
    return path


def _format_eta(eta_seconds: float | None) -> str | None:
    if eta_seconds is None or eta_seconds < 0:
        return None
    if eta_seconds < 60:
        return f"{int(eta_seconds)}s"
    minutes = int(eta_seconds // 60)
    seconds = int(eta_seconds % 60)
    if minutes < 60:
        return f"{minutes}m {seconds}s"
    hours = int(minutes // 60)
    minutes %= 60
    return f"{hours}h {minutes}m"


@dataclass
class DownloadJob:
    id: str
    url: str
    filename: str
    destination: str | None
    status: str = "pending"
    progress_bytes: int = 0
    total_bytes: int | None = None
    percent: float = 0.0
    speed_bps: float | None = None
    eta_seconds: float | None = None
    error_message: str | None = None
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    local_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "url": self.url,
            "filename": self.filename,
            "destination": self.destination,
            "status": self.status,
            "progress_bytes": self.progress_bytes,
            "total_bytes": self.total_bytes,
            "percent": round(self.percent, 2),
            "speed_bps": self.speed_bps,
            "eta_seconds": self.eta_seconds,
            "eta_formatted": _format_eta(self.eta_seconds),
            "error_message": self.error_message,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "local_path": self.local_path,
        }


class DownloadManager:
    def __init__(self, default_dir: Path = DEFAULT_DOWNLOAD_DIR):
        self.default_dir = default_dir
        self._jobs: dict[str, DownloadJob] = {}
        self._tasks: dict[str, asyncio.Task] = {}
        self._cancel_events: dict[str, asyncio.Event] = {}
        self._lock = asyncio.Lock()

    async def start_download(
        self,
        url: str,
        filename: str | None = None,
        destination: str | None = None,
    ) -> DownloadJob:
        dest_dir = Path(destination).expanduser() if destination else self.default_dir
        _ensure_dir(dest_dir)

        out_filename = filename or url.split("/")[-1].split("?")[0] or "download.bin"
        out_path = dest_dir / out_filename

        job = DownloadJob(
            id=str(uuid.uuid4()),
            url=url,
            filename=out_filename,
            destination=str(out_path.parent) if destination else None,
            local_path=str(out_path.resolve()),
        )

        async with self._lock:
            self._jobs[job.id] = job
            self._cancel_events[job.id] = asyncio.Event()

        task = asyncio.create_task(self._run_download(job.id))
        async with self._lock:
            self._tasks[job.id] = task

        return job

    async def _run_download(self, job_id: str) -> None:
        job = self._jobs.get(job_id)
        if not job:
            return

        cancel_event = self._cancel_events.get(job_id)
        if not cancel_event:
            return

        out_path = Path(job.local_path) if job.local_path else self.default_dir / job.filename
        _ensure_dir(out_path.parent)

        headers: dict[str, str] = {}
        start_byte = 0
        if out_path.exists():
            start_byte = out_path.stat().st_size
            headers["Range"] = f"bytes={start_byte}-"

        job.status = "running"
        job.progress_bytes = start_byte
        job.updated_at = time.time()

        start_time = time.time()
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
                async with client.stream("GET", job.url, headers=headers) as response:
                    if response.status_code not in (200, 206):
                        raise RuntimeError(f"Download failed: HTTP {response.status_code}")

                    total_header = response.headers.get("Content-Length")
                    if total_header:
                        total = int(total_header) + start_byte
                    else:
                        total = None
                    job.total_bytes = total

                    mode = "ab" if start_byte else "wb"
                    downloaded = start_byte
                    with open(out_path, mode) as f:
                        async for chunk in response.aiter_bytes(chunk_size=8192):
                            if cancel_event.is_set():
                                job.status = "cancelled"
                                job.updated_at = time.time()
                                return

                            if chunk:
                                f.write(chunk)
                                downloaded += len(chunk)
                                job.progress_bytes = downloaded
                                now = time.time()
                                elapsed = now - start_time
                                if elapsed > 0:
                                    job.speed_bps = downloaded / elapsed
                                if job.total_bytes and job.speed_bps:
                                    remaining = job.total_bytes - downloaded
                                    job.eta_seconds = remaining / job.speed_bps
                                    job.percent = (downloaded / job.total_bytes) * 100
                                job.updated_at = now

                    job.status = "completed"
                    job.percent = 100.0 if job.total_bytes else job.percent
                    job.eta_seconds = 0
                    job.updated_at = time.time()

        except asyncio.CancelledError:
            job.status = "cancelled"
            job.updated_at = time.time()
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            job.updated_at = time.time()
        finally:
            async with self._lock:
                self._tasks.pop(job_id, None)
                self._cancel_events.pop(job_id, None)

    async def cancel_job(self, job_id: str) -> DownloadJob | None:
        job = self._jobs.get(job_id)
        if not job:
            return None

        if job.status in ("completed", "failed", "cancelled"):
            return job

        event = self._cancel_events.get(job_id)
        if event:
            event.set()

        task = self._tasks.get(job_id)
        if task and not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

        job.status = "cancelled"
        job.updated_at = time.time()
        return job

    def get_job(self, job_id: str) -> DownloadJob | None:
        return self._jobs.get(job_id)

    def list_jobs(self) -> list[DownloadJob]:
        return list(self._jobs.values())

    async def cleanup_completed(self, max_age_seconds: float = 3600) -> int:
        now = time.time()
        removed = 0
        async with self._lock:
            stale = [
                job_id
                for job_id, job in self._jobs.items()
                if job.status in ("completed", "failed", "cancelled")
                and (now - job.updated_at) > max_age_seconds
            ]
            for job_id in stale:
                self._jobs.pop(job_id, None)
                removed += 1
        return removed
