#!/usr/bin/env python3
"""Build the full AI Model Browser desktop app.

This script:
1. Builds the Python backend sidecar with PyInstaller.
2. Builds the frontend production assets.
3. Builds the Tauri desktop app bundle.

Run from the project root:
    python build_app.py
"""

import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

PROJECT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = PROJECT_DIR / "backend"
FRONTEND_DIR = PROJECT_DIR / "frontend"
TAURI_DIR = PROJECT_DIR / "src-tauri"


def run(command: list[str] | str, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    """Run a shell command and stream output."""
    print(f"\n$ {' '.join(command) if isinstance(command, list) else command}")
    merged_env = os.environ.copy()
    # Ensure Rust/Cargo tooling is available for the Tauri CLI.
    cargo_bin = str(Path.home() / ".cargo" / "bin")
    if cargo_bin not in merged_env.get("PATH", ""):
        merged_env["PATH"] = f"{cargo_bin}{os.pathsep}{merged_env.get('PATH', '')}"
    if env:
        merged_env.update(env)
    subprocess.run(command, cwd=cwd, env=merged_env, check=True)


def build_sidecar() -> None:
    """Build the Python backend as a Tauri sidecar binary."""
    print("==> Building backend sidecar with PyInstaller...")
    venv_python = BACKEND_DIR / "venv" / "bin" / "python"
    if not venv_python.exists():
        venv_python = BACKEND_DIR / "venv" / "Scripts" / "python.exe"
    if not venv_python.exists():
        raise FileNotFoundError("Backend virtual environment not found at backend/venv")
    run([str(venv_python), str(BACKEND_DIR / "build_sidecar.py")], cwd=BACKEND_DIR)


def build_frontend() -> None:
    """Build the Vite frontend production bundle."""
    print("==> Building frontend...")
    run(["npm", "install"], cwd=FRONTEND_DIR)
    run(["npm", "run", "build"], cwd=FRONTEND_DIR)


def build_tauri() -> None:
    """Build the Tauri desktop app."""
    print("==> Building Tauri app bundle...")
    # Use the local tauri binary if cargo-tauri is not installed globally.
    tauri_bin = FRONTEND_DIR / "node_modules" / ".bin" / "tauri"
    if not tauri_bin.exists():
        raise FileNotFoundError("Tauri CLI not found in frontend/node_modules/.bin/tauri")

    # The local npm-installed tauri binary does not reliably resolve the
    # relative `../frontend` path in beforeBuildCommand. Patch to an absolute
    # path temporarily, then restore it so the repo stays portable.
    conf_path = TAURI_DIR / "tauri.conf.json"
    original_conf = conf_path.read_text()
    patched_conf = original_conf.replace(
        '"beforeBuildCommand": "cd ../frontend && npm run build",',
        f'"beforeBuildCommand": "cd {FRONTEND_DIR} && npm run build",',
    )
    if patched_conf == original_conf:
        raise RuntimeError("Could not patch beforeBuildCommand in tauri.conf.json")
    conf_path.write_text(patched_conf)
    try:
        # Cargo's build script caching does not notice when frontend/dist
        # files change, so the old JS bundle can remain embedded in the
        # Rust binary. Clean this package so Tauri re-embeds the latest
        # frontend assets every time.
        run(["cargo", "clean", "-p", "ai-model-browser"], cwd=TAURI_DIR)
        run([str(tauri_bin), "build"], cwd=TAURI_DIR)
    finally:
        conf_path.write_text(original_conf)


def open_bundle_folder() -> None:
    """Open the folder containing the built app bundle."""
    system = platform.system().lower()
    if system == "darwin":
        bundle_dir = TAURI_DIR / "target" / "release" / "bundle" / "macos"
    elif system == "windows":
        bundle_dir = TAURI_DIR / "target" / "release" / "bundle" / "msi"
    else:
        bundle_dir = TAURI_DIR / "target" / "release" / "bundle"

    if bundle_dir.exists():
        print(f"\n==> App bundle available at: {bundle_dir}")
        if system == "darwin":
            run(["open", str(bundle_dir)])


def main() -> None:
    if not PROJECT_DIR.exists():
        raise RuntimeError("Project directory not found")

    # Verify required tooling.
    for tool in ["npm"]:
        if shutil.which(tool) is None:
            raise RuntimeError(f"Required tool not found: {tool}")

    build_sidecar()
    build_frontend()
    build_tauri()
    open_bundle_folder()
    print("\n✅ Build complete.")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as e:
        print(f"\n❌ Build failed: {e}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"\n❌ Missing dependency: {e}", file=sys.stderr)
        sys.exit(1)
