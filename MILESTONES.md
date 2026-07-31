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

## Remaining Planned Milestones (from `PROJECT_PLAN.md`)

| # | Milestone | Status | What it adds |
| :- | :--------- | :----- | :----------- |
| 8 | **Download Progress & Queue** | 🔲 Not started | Background downloads, progress bars/ETA, cancel buttons, download queue panel. |
| 9 | **Local Library Runner Commands** | 🔲 Not started | Generate ready-to-run commands for llama.cpp, Ollama, LM Studio, KoboldCpp, vLLM; copy-to-clipboard; store preferred runner. |
| 10 | **Standalone Tauri Desktop Build** | 🔲 Not started | Bundle React + Python backend into a single `.app`/`.exe`; manage backend sidecar lifecycle. |

## Recommended Next Milestones

### Immediate next step: **Milestone 9 — Local Library Runner Commands**
Why this first:
- It is the smallest, safest next feature after the recent Discover/Library polish.
- It turns the local inventory from a passive list into something the user can actually launch.
- It does not require long-running background jobs or the Rust/Tauri build pipeline.

What to build:
1. Add a `LauncherService` / endpoint that, given a local inventory item, produces shell commands for each supported runner.
2. Extend the Library view so each file has a "Run With" dropdown and a copy-to-clipboard button.
3. Store the last-used runner per file in SQLite.

### After that: **Milestone 8 — Download Progress & Queue**
Why second:
- Downloads already work, but they are synchronous and silent.
- Adding a queue means introducing background tasks (threading or asyncio queue) and a polling/WebSocket endpoint, which is more invasive than runner commands.

What to build:
1. Replace the synchronous `download_file` service with an in-memory or SQLite-backed job queue.
2. Add `GET /api/download/jobs` and `GET /api/download/jobs/{id}` for progress/ETA.
3. Add a download panel to the frontend with progress bars and cancel buttons.

### Final major step: **Milestone 10 — Standalone Tauri Desktop Build**
Why last:
- This is the largest milestone and depends on a working Rust toolchain and `cargo`.
- It only makes sense once the app features are complete enough that a standalone build is worth shipping.

What to build:
1. Configure `src-tauri/` to embed the Vite frontend and start the Python backend as a sidecar.
2. Package the backend Python environment (venv or PyInstaller binary).
3. Build and smoke-test the macOS `.app` bundle, then document Windows/Linux steps.

## Optional Nice-to-Haves (not in `PROJECT_PLAN.md`)

- **Model benchmarks / leaderboard integration** — show tokens/second or MMLU scores when available.
- **Favourites / watchlist** — let users star models and get notified of new quantizations.
- **Offline README cache** — cache fetched README snippets to reduce Hugging Face API calls.
- **Dark/light theme toggle** — currently hard-coded dark mode.
- **Keyboard shortcuts** — e.g. `/` to focus search, `Cmd/Ctrl + K` command palette.
