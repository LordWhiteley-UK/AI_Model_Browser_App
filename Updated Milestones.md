# AI Model Browser — Milestone Tracker

This file records the features that have already been built, what is currently in `PROJECT_PLAN.md`, and the recommended order for the next milestones.

## Implemented Milestones

| # | Milestone | Status | Highlights |
| :- | :--------- | :----- | :--------- |
| 1 | **Core Skeleton & Communication** | ✅ Complete | Tauri v2 + React TypeScript scaffold, FastAPI backend, `/api/health` status card on the frontend. |
| 2 | **Hardware Detection & Profile Management** | ✅ Complete | `hardware_detector.py` with `psutil`/platform detection, SQLite/SQLModel schema, seeded default profiles, `HardwareProfiles.tsx` view with system specs panel and active-profile switching. |
| 3 | **Local Folder Ingestion & Auto-Tagging** | ✅ Complete | `POST /api/inventory/scan`, recursive GGUF/Safetensors/BIN/ONNX scanning, folder-name capability tagging, `LocalLibrary.tsx` view. |
| 4 | **Hugging Face Discovery & Search** | ✅ Complete | `huggingface.py` provider, `GET /api/discover/search`, file grouping by family, `Discover.tsx` with search/capability filters and model cards. |
| 5 | **Hardware Compatibility Rating UI** | ✅ Complete | `compatibility_engine.py`, traffic-light Green/Yellow/Red badges on every file in Discover/Library. |
| 6 | **Download & Launcher Integration** | ✅ Complete | Direct file download endpoint, copy-to-clipboard download URL for external runners (Ollama, llama.cpp, LM Studio, KoboldCpp). |
| 7 | **User-Defined Hardware Profiles** | ✅ Complete | Create/delete custom profiles with curated CPU/GPU dropdowns, RAM type/amount, VRAM, and unified-memory toggle; DB migration for new `gpu_name`/`ram_type` columns. |
| — | **Popular/Trending Discover Tabs** | ✅ Complete | Popular tab shows most-downloaded Hugging Face models; Trending tab uses `trendingScore`. |
| — | **Format Filter** | ✅ Complete | Second filter pill row for GGUF, Safetensors, MLX, Pickled, ONNX, EXL2. |
| — | **README-Based Model Descriptions** | ✅ Complete | Short description on each model card, extracted from model card or `README.md` fallback. |
| — | **Extended Capability Filters** | ✅ Complete | Added Tool Use, Reasoning, Embedding, Audio, and Multimodal filters. |
| — | **Author/Org Brand Icons** | ✅ Complete | Simple-icons brand logos (Google, NVIDIA, Meta, Mistral, Qwen, Anthropic, DeepSeek, etc.) on model cards. |
| — | **Model Publication Date** | ✅ Complete | `created_at` shown on each Discover model card with Calendar icon. |
| 9 | **Local Library Runner Commands** | ✅ Complete | Generate ready-to-run commands for Ollama, llama.cpp, LM Studio, KoboldCpp, vLLM; store preferred runner per file; copy-to-clipboard in launcher modal. |
| 10 | **Standalone Tauri Desktop Build** | ✅ Complete | Tauri v2 macOS `.app` bundle with PyInstaller backend sidecar, auto-spawn/kill lifecycle, env-configured SQLite DB. |

## Remaining Planned Milestones (from `PROJECT_PLAN.md`)

| # | Milestone | Status | What it adds |
| :- | :--------- | :----- | :----------- |
| 8 | **Download Progress & Queue** | ✅ Complete | In-memory async download job queue with progress/ETA/speed, cancel and delete endpoints, Downloads view with progress bars and status badges. |
| 9 | **Local Library Runner Commands** | ✅ Complete | Generate ready-to-run commands for Ollama, llama.cpp, LM Studio, KoboldCpp, vLLM; store preferred runner per file; copy-to-clipboard in launcher modal. |
| 10 | **Standalone Tauri Desktop Build** | ✅ Complete | Bundle React + Python backend into a single `.app`/`.exe`; manage backend sidecar lifecycle. |
| 11 | **Runner Detection & Shared Model Folder** | ✅ Complete | Detect Ollama/LM Studio/llama.cpp, Runner Settings view with manual overrides, download-to-LM-Studio folder move, Ollama Modelfile + `ollama create` import, Library import button. |

### Why Milestone 11 isn't a single shared folder
- **llama.cpp** has no library concept — it takes a direct file path, so any shared folder already works with zero integration.
- **LM Studio** supports a configurable models directory with a known `publisher/repo/file.gguf` layout — the app can write straight into it.
- **Ollama** uses a content-addressable blob store keyed by manifest, not plain files — it can't scan an arbitrary folder. The workable path is generating a `Modelfile` (`FROM ./file.gguf`) and running `ollama create` so Ollama ingests the file on its own terms.
- Detection (checking `PATH`, known install directories, reading LM Studio's config JSON) can be done today from the existing local FastAPI backend — it doesn't require waiting for the Milestone 10 desktop build.

## Recommended Next Milestones

All original milestones from `PROJECT_PLAN.md` are complete. The next steps are polish and cross-platform work, not new numbered milestones.

### Immediate next step: **Cross-platform desktop builds**
Why this first:
- The macOS `.app` bundle is already working. Windows and Linux builds are the next logical step to make the app usable everywhere.

What to build:
1. Build a Windows `.exe` installer (NSIS or MSI) using Tauri.
2. Build a Linux AppImage / `.deb` bundle using Tauri.
3. Add CI scripts or local documentation for repeatable builds on each platform.
4. Handle platform-specific paths (e.g., `%APPDATA%`, `~/.config`, `~/Library/Application Support`) for the bundled backend data directory.

### Follow-up polish (no milestone number)
- Add a startup health-retry UX so the frontend waits gracefully for the backend sidecar.
- Add system tray icon and quit/relaunch actions.
- Add automatic update checks.
- Add a first-run onboarding screen.
- Improve bundled backend logging and a way to view logs from the UI.

## Optional Nice-to-Haves (not in `PROJECT_PLAN.md`)

- **Model benchmarks / leaderboard integration** — show tokens/second or MMLU scores when available.
- **Favourites / watchlist** — let users star models and get notified of new quantizations.
- **Offline README cache** — cache fetched README snippets to reduce Hugging Face API calls.
- **Dark/light theme toggle** — currently hard-coded dark mode.
- **Keyboard shortcuts** — e.g. `/` to focus search, `Cmd/Ctrl + K` command palette.
- **Semantic/embedding search** — match on intent ("small model good at function calling"), not just keyword/tag matches.
- **License filter** — commercial-use-allowed vs. research-only vs. gated repos.
- **Model card diff/changelog** — flag when a repo's README or config changed since last seen.
- **LoRA/adapter awareness** — detect adapters and link them to their base model instead of listing as standalone entries.
- **Auto-quant recommendation** — suggest the best-fit quant for the active hardware profile, not just red/yellow/green per file.
- **Context-length headroom calculator** — show usable context at current VRAM before OOM.
- **CPU/GPU layer-split calculator** — for partial offload (`--n-gpu-layers` style) scenarios.
- **Duplicate/redundant quant detection** — flag near-duplicate quants of the same model already in the library.
- **Update notifications** — alert when a newer/fixed quant of a downloaded model appears.
- **Import/export hardware profiles** — shareable JSON across machines.
- **Resume-capable, throttled downloads** — pause/resume, bandwidth cap.
- **In-app benchmark logging** — record actual tokens/sec per model+hardware combo, feeding a local leaderboard.
- **Saved searches / search history**
- **Custom collections** — user-defined groupings separate from favourites.
- **Built-in test chat pane** — hit the configured runner endpoint directly to sanity-check a model without leaving the app.
- **OS-aware compatibility tagging** — extend `compatibility_engine.py` so MLX files are flagged incompatible/hidden on non-macOS hardware profiles, the same way VRAM already gates GGUF quants.
