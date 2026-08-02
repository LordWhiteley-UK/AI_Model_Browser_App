# Building AI Model Browser

This app is a Tauri v2 desktop shell around a Vite + React frontend and a Python FastAPI backend packaged as a sidecar binary.

## Prerequisites

- Node.js 20+
- Rust toolchain (`rustc`, `cargo`)
- Python 3.11 (for the sidecar build; avoid 3.10.0 due to a PyInstaller recursion bug)

## Project layout

```
.
├── backend/          FastAPI + SQLModel backend
├── frontend/         React + TypeScript + Vite UI
├── src-tauri/        Tauri v2 Rust shell
│   └── binaries/     PyInstaller sidecar output (gitignored)
└── .github/workflows/build.yml  CI builds for macOS/Windows/Linux
```

## Local macOS build

```bash
# 1. Build the Python backend sidecar in a Python 3.11 venv
python3.11 -m venv venv-build
./venv-build/bin/pip install -r backend/requirements.txt pyinstaller
./venv-build/bin/python backend/build_sidecar.py

# 2. Install frontend dependencies
cd frontend && npm install

# 3. Build the Tauri .app bundle
cd ..
./frontend/node_modules/.bin/tauri build
```

The resulting `.app` is at:

```
src-tauri/target/release/bundle/macos/AI Model Browser.app
```

## Windows build

On a Windows machine or GitHub Actions runner:

```powershell
# 1. Build sidecar
python -m venv venv-build
.\venv-build\Scripts\pip install -r backend\requirements.txt pyinstaller
.\venv-build\Scripts\python backend\build_sidecar.py

# 2. Install frontend
cd frontend
npm install

# 3. Build Tauri app
npm run tauri -- build
```

Outputs are written to `src-tauri/target/release/bundle/nsis/` and `src-tauri/target/release/bundle/msi/`.

Notes for Windows:
- The first build requires the **Microsoft Visual C++ (MSVC) toolchain**. On a clean machine install the **Build Tools for Visual Studio 2022** workload "Desktop development with C++".
- The backend sidecar will be named `src-tauri/binaries/backend-x86_64-pc-windows-msvc.exe`.
- The SQLite database is stored under `%APPDATA%\com.aimodelbrowser.desktop\backend\models.db` when the app is launched through Tauri.

## Linux build

On an Ubuntu machine or GitHub Actions runner:

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

# Build sidecar
python3.11 -m venv venv-build
./venv-build/bin/pip install -r backend/requirements.txt pyinstaller
./venv-build/bin/python backend/build_sidecar.py

# Build frontend + Tauri
cd frontend
npm install
npm run tauri -- build
```

Outputs are written to `src-tauri/target/release/bundle/deb/` and `src-tauri/target/release/bundle/appimage/`.

## CI builds

GitHub Actions builds all three platforms automatically on every push to `main`:

- `.github/workflows/build.yml`
- Artifacts are uploaded per platform under `tauri-bundle-<platform>`.

To trigger manually, go to **Actions → Build AI Model Browser → Run workflow**.

## Notes

- The backend sidecar filename must follow Tauri’s external binary convention:
  `backend-<target_triple>` (e.g. `backend-aarch64-apple-darwin`).
  `backend/build_sidecar.py` handles this automatically.
- The bundled backend stores its SQLite database under the Tauri app data directory
  via the `AI_MODEL_BROWSER_DB_URL` environment variable set by `src-tauri/src/lib.rs`.
- Tauri Rust crates and NPM packages are pinned to major/minor 2.0.x to avoid version
  mismatches during the build.
