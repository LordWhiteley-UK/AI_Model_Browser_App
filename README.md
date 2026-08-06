# AI Model Browser

Discover, download, and run local AI models on your own hardware.

AI Model Browser is a desktop app that wraps a Python FastAPI backend inside a Tauri v2 shell. The frontend is built with React 18, TypeScript, and Tailwind CSS. The backend uses Uvicorn, SQLModel/SQLAlchemy, and SQLite. A PyInstaller-built sidecar is bundled with the app so end users do not need Python installed.

## Screenshots

| Dashboard | Discover Models | Downloads |
|---|---|---|
| ![Dashboard](docs/screenshots/dashboard.png) | ![Discover Models](docs/screenshots/discover.png) | ![Downloads](docs/screenshots/downloads.png) |

| User Manual | About |
|---|---|
| ![User Manual](docs/screenshots/manual.png) | ![About](docs/screenshots/about.png) |

## Features

- **Discover Models** — Search Hugging Face by keyword, capability, or file format. See compatibility with your active hardware profile before downloading.
- **Downloads** — Queue model files, track progress, cancel, delete, and limit bandwidth. Downloads support HTTP Range resume.
- **Local Library** — Scan folders for GGUF, Safetensors, MLX, Pickled, ONNX, and EXL2 files. Launch or import models into Ollama.
- **Hardware Profiles** — Create and switch profiles to match the machine the model will run on.
- **Runner Settings** — Detect and configure Ollama, LM Studio, llama.cpp, and other OpenAI-compatible runners.
- **Test Chat** — Send prompts to a local model and stream the response back in the app.
- **Backend Logs** — Open a live log panel to inspect the bundled backend sidecar.
- **User Manual** — Built-in help page covering every section of the app.
- **Cross-platform builds** — GitHub Actions builds and uploads separate macOS, Windows, and Linux bundles.

## Project layout

```
.
├── backend/          # FastAPI + SQLModel backend
│   ├── build_sidecar.py
│   ├── main.py
│   ├── models/
│   ├── providers/
│   ├── seed.py
│   └── services/
├── frontend/         # React + TypeScript + Vite UI
│   └── src/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── views/
├── src-tauri/        # Tauri v2 Rust shell
│   ├── binaries/     # PyInstaller sidecar output (gitignored)
│   ├── capabilities/
│   ├── icons/
│   └── src/
├── .github/workflows/build.yml  # CI builds
├── BUILD.md          # Detailed local build instructions
└── README.md         # This file
```

## Quick start

### Prerequisites

- Node.js 20+
- Rust toolchain (`cargo`)
- Python 3.11 (for the sidecar build; avoid Python 3.10.0 due to a PyInstaller recursion bug)

### macOS

```bash
# Build the backend sidecar
python3.11 -m venv venv-build
./venv-build/bin/pip install -r backend/requirements.txt pyinstaller
./venv-build/bin/python backend/build_sidecar.py

# Install frontend dependencies and build the .app bundle
cd frontend
npm install
cd ..
./frontend/node_modules/.bin/tauri build
```

The resulting app is at:

```
src-tauri/target/release/bundle/macos/AI Model Browser.app
```

### Windows

```powershell
# Build the backend sidecar
python -m venv venv-build
.\venv-build\Scripts\pip install -r backend\requirements.txt pyinstaller
.\venv-build\Scripts\python backend\build_sidecar.py

# Install frontend dependencies and build the installer
cd frontend
npm install
npm run tauri -- build
```

Installers are placed in:

```
src-tauri/target/release/bundle/nsis/AI Model Browser_<version>_x64-setup.exe
src-tauri/target/release/bundle/msi/AI Model Browser_<version>_x64_en-US.msi
```

### Linux

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.0-dev libappindicator3-dev librsvg2-dev patchelf

# Build the backend sidecar
python3.11 -m venv venv-build
./venv-build/bin/pip install -r backend/requirements.txt pyinstaller
./venv-build/bin/python backend/build_sidecar.py

# Install frontend dependencies and build the installer
cd frontend
npm install
npm run tauri -- build
```

Installers are placed in:

```
src-tauri/target/release/bundle/deb/
src-tauri/target/release/bundle/appimage/
```

See `BUILD.md` for full local build and CI instructions.

## macOS Gatekeeper notice

The DMG downloaded from GitHub Releases is not currently code-signed or notarized. macOS may show a message saying the app is "damaged" and can't be opened. The file is not corrupted; this is Gatekeeper's stricter handling of apps downloaded from the internet.

To open the app:

1. Drag `AI Model Browser.app` from the mounted DMG into **Applications**.
2. Open **Terminal** and run:

```bash
xattr -cr /Applications/AI\ Model\ Browser.app
```

3. Launch the app from **Applications**. If a " cannot be opened" prompt appears, open **System Settings → Privacy & Security** and click **Allow Anyway**.

Alternatively, you can build the app locally (see the macOS quick start above). A locally built app does not carry the internet-download quarantine flag and usually opens without this extra step.

## Usage

1. Launch the app. A startup overlay shows backend sidecar logs until the backend health check passes.
2. Open **Discover** and search for a model, or browse Popular / Trending.
3. Pick a capability and format filter, then expand a model family to see downloadable files.
4. Click **Download** on a file. Choose the default folder, LM Studio folder, or Ollama import target.
5. Track progress in **Downloads**. Set a bandwidth cap if needed.
6. When the download completes, go to **Local Library** to launch or import the model.
7. Use **Test Chat** to prompt a loaded model through your preferred runner.

For detailed guidance, open the **Help** page from the top navigation.

## Configuration

The bundled backend stores its SQLite database under the Tauri app data directory. The backend listens on `127.0.0.1:8000` by default. These are set automatically by `src-tauri/src/lib.rs`; you do not need to configure them manually.

## Development

```bash
# Terminal 1: start the backend in dev mode
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py

# Terminal 2: start the Vite frontend
cd frontend
npm install
npm run dev

# Terminal 3 (optional): run the Tauri dev shell
cd frontend
npm run tauri dev
```

The Vite dev server runs at `http://localhost:1420`. The backend runs at `http://127.0.0.1:8000`.

## Building releases

GitHub Actions builds release bundles for macOS, Windows, and Linux on every push to `main`. Artifacts are uploaded per platform under these names:

- `tauri-bundle-macos-latest`
- `tauri-bundle-windows-latest`
- `tauri-bundle-ubuntu-latest`

To trigger manually, go to **Actions → Build AI Model Browser → Run workflow** in GitHub.

For local release builds, see `BUILD.md`.

## Testing

- `cd frontend && npm run build` — type-check and bundle the frontend.
- Launch the bundled app and use the in-app **Help** and **About** pages.
- Inspect backend sidecar output in the **Logs** panel.

## Contributing

Contributions are welcome. Please open an issue or pull request on GitHub.

## License

MIT License. See the repository for the full license text.

## Acknowledgements

- [Tauri](https://tauri.app/) — desktop app shell
- [React](https://react.dev/) and [Vite](https://vitejs.dev/) — frontend tooling
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [FastAPI](https://fastapi.tiangolo.com/), [Uvicorn](https://www.uvicorn.org/), [SQLModel](https://sqlmodel.tiangolo.com/) — backend stack
- [Hugging Face Hub](https://huggingface.co/) — model discovery
- [Lucide](https://lucide.dev/) — icons
- [PyInstaller](https://pyinstaller.org/) — backend sidecar packaging
