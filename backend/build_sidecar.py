import platform
import shutil
import sys
from pathlib import Path

sys.setrecursionlimit(10000)

import PyInstaller.__main__

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BACKEND_DIR.parent
BINARIES_DIR = PROJECT_DIR / "src-tauri" / "binaries"


def target_triple() -> str:
    machine = platform.machine().lower()
    system = platform.system().lower()
    if system == "darwin":
        return "aarch64-apple-darwin" if machine in ("arm64", "aarch64") else "x86_64-apple-darwin"
    elif system == "windows":
        return "x86_64-pc-windows-msvc"
    elif system == "linux":
        return "aarch64-unknown-linux-gnu" if machine in ("arm64", "aarch64") else "x86_64-unknown-linux-gnu"
    raise RuntimeError(f"Unsupported platform: {system}/{machine}")


def main():
    BINARIES_DIR.mkdir(parents=True, exist_ok=True)

    hidden_imports = [
        # Project modules
        "services.compatibility_engine",
        "services.download_queue",
        "services.hardware_detector",
        "services.launcher",
        "services.local_scanner",
        "services.runner_detector",
        "services.runner_integration",
        "services.settings_service",
        "services.url_parser",
        "models.hardware",
        "models.inventory",
        "models.model_family",
        "models.model_file",
        "models.runner_settings",
        "models.app_settings",
        "seed",
        "database",
        "providers.huggingface",
        "providers.base",
        # Uvicorn internals
        "uvicorn.subprocess",
        "uvicorn.protocols.http.auto",
        "uvicorn.protocols.http.h11_impl",
        "uvicorn.protocols.http.httptools_impl",
        "uvicorn.protocols.websockets.auto",
        "uvicorn.protocols.websockets.websockets_impl",
        "uvicorn.protocols.websockets.wsproto_impl",
        "uvicorn.loops.auto",
        "uvicorn.loops.asyncio",
        "uvicorn.logging",
        # FastAPI internals
        "fastapi.dependencies.utils",
        "fastapi.middleware.cors",
        # SQLModel / SQLAlchemy
        "sqlmodel.main",
        "sqlalchemy.ext.asyncio",
        "sqlalchemy.dialects.sqlite",
        # Other
        "httpx",
        "huggingface_hub",
        "psutil",
        "pynvml",
    ]

    collect_data = [
        "huggingface_hub",
        "sqlalchemy",
        "fastapi",
        "uvicorn",
    ]

    args = [
        str(BACKEND_DIR / "main.py"),
        "--onefile",
        "--name", "backend",
        "--distpath", str(BINARIES_DIR),
        "--workpath", str(BACKEND_DIR / "build" / "sidecar"),
        "--specpath", str(BACKEND_DIR / "build" / "sidecar"),
        "--noconfirm",
        "--clean",
    ]
    for imp in hidden_imports:
        args.extend(["--hidden-import", imp])
    for pkg in collect_data:
        args.extend(["--collect-data", pkg])

    print("Running PyInstaller with args:", args)
    PyInstaller.__main__.run(args)

    # Rename to Tauri sidecar naming convention.
    triple = target_triple()
    ext = ".exe" if platform.system().lower() == "windows" else ""
    src = BINARIES_DIR / f"backend{ext}"
    dst = BINARIES_DIR / f"backend-{triple}{ext}"
    if dst.exists():
        dst.unlink()
    shutil.move(str(src), str(dst))
    print(f"Built sidecar: {dst}")


if __name__ == "__main__":
    main()
