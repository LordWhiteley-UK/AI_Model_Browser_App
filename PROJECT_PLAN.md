# AI Model Browser - Project Blueprint & Execution Plan

## 1. Project Overview & Vision
**AI Model Browser** is a lightweight, cross-platform desktop application designed to discover, recommend, benchmark, and manage local AI models across multiple file formats (GGUF, EXL2, Safetensors, MLX, ONNX). It acts purely as a model discovery engine, local library manager, and hardware compatibility evaluator—**it is NOT an inference engine**.

### Core Value Proposition
- **LM Studio-style discovery UI** powered by Hugging Face API and local folder indexing.
- **Hardware-aware compatibility engine** with traffic-light scoring (Green/Yellow/Red).
- **Engine-agnostic architecture** capable of sending model file paths to external runners (Ollama, llama.cpp, LM Studio, KoboldCpp, vLLM).
- **Hardware Profile Switcher** supporting both Apple Unified Memory (macOS) and Discrete GPU + System RAM configurations (Windows/Linux).

---

## 2. Target Hardware Profiles Configuration

The application must support managing and toggling between these pre-configured hardware profiles:

| Profile Name | OS | System RAM | VRAM | Architecture Type | VRAM Overhead / Safety Factor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **MacBook Air 2024** | macOS | 24 GB | N/A (Unified) | Unified Memory | 75% max available to model (~18 GB) |
| **Mac Mini M4 Pro** | macOS | 64 GB | N/A (Unified) | Unified Memory | 80% max available to model (~51 GB) |
| **Gaming Rig** | Windows 11 | 128 GB DDR5 | 16 GB (RTX 5080) | Discrete Split Memory | VRAM: 16 GB max offload; RAM: 128 GB overflow |

---

## 3. Technology Stack

- **Frontend Application Shell:** React 18, TypeScript, TailwindCSS / Lucide-react icons.
- **Desktop Runtime Environment:** Tauri v2 (Rust shell).
- **Backend Service (Sidecar):** Python 3.10+ (FastAPI, Uvicorn, SQLModel/SQLAlchemy).
- **Embedded Database:** SQLite (`models.db`).
- **External Integrations:** Hugging Face REST API (`huggingface_hub`).

---

## 4. Architecture & Directory Structure

```text
ai-model-browser/
├── PROJECT_PLAN.md
├── src-tauri/                       # Tauri v2 Native Shell
│   ├── tauri.conf.json
│   └── src/
├── frontend/                        # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/              # UI components (ModelCard, HardwareBadge, FilterBar)
│   │   ├── views/                   # Pages (Discover, Library, HardwareProfiles, Settings)
│   │   ├── api/                     # Axios/Fetch API client functions
│   │   └── types/                   # TypeScript interfaces
│   ├── package.json
│   └── tsconfig.json
└── backend/                         # Python FastAPI Sidecar
    ├── main.py                      # FastAPI App Entry Point
    ├── database.py                  # SQLite connection & session management
    ├── models/                      # SQLModel DB Schemas
    │   ├── hardware.py
    │   ├── model_family.py
    │   ├── model_file.py
    │   └── inventory.py
    ├── services/                    # Business Logic
    │   ├── hardware_detector.py     # System detection via psutil/pynvml
    │   ├── compatibility_engine.py  # VRAM/RAM fit calculation
    │   └── local_scanner.py         # Local folder ingestion & auto-tagging
    ├── providers/                   # Model Data Sources
    │   ├── base.py                  # Abstract Provider Interface
    │   └── huggingface.py           # HF Hub Search & Parsing
    └── requirements.txt
```

---

## 5. Database Schema (SQLite)

```sql
-- Hardware Profiles
CREATE TABLE hardwareprofile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    os VARCHAR NOT NULL,
    cpu_name VARCHAR,
    total_ram_gb FLOAT NOT NULL,
    total_vram_gb FLOAT DEFAULT 0.0,
    is_unified_memory BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- High-level Model Family (e.g., "Llama-3-8B-Instruct")
CREATE TABLE modelfamily (
    id VARCHAR PRIMARY KEY, -- Hugging Face repo ID (e.g., 'meta-llama/Meta-Llama-3-8B')
    name VARCHAR NOT NULL,
    author VARCHAR NOT NULL,
    architecture VARCHAR,
    params_billions FLOAT,
    context_length INTEGER,
    capabilities VARCHAR, -- Comma-separated tags: "LLM,Coding,Vision"
    downloads INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    updated_at DATETIME
);

-- Specific Quantized Model Files (e.g., "Meta-Llama-3-8B-Instruct-Q4_K_M.gguf")
CREATE TABLE modelfile (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    family_id VARCHAR REFERENCES modelfamily(id),
    filename VARCHAR NOT NULL,
    format VARCHAR NOT NULL, -- 'GGUF', 'EXL2', 'Safetensors', 'MLX', 'ONNX'
    quant_method VARCHAR,    -- 'Q4_K_M', 'Q8_0', 'FP16', etc.
    size_bytes BIGINT NOT NULL,
    download_url VARCHAR NOT NULL,
    estimated_vram_mb FLOAT
);

-- Local Model Files on Disk
CREATE TABLE localinventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id INTEGER REFERENCES modelfile(id),
    local_path VARCHAR UNIQUE NOT NULL,
    detected_format VARCHAR,
    detected_capability VARCHAR, -- Derived from subfolders (e.g. GGUF/Vision)
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Compatibility Engine Algorithm

When evaluating a model file against an active `HardwareProfile`:

1. **Required Memory Calculation ($M_{req}$):**
   $$M_{req} \approx \text{File Size (GB)} \times 1.15 \quad (\text{Includes context buffer overhead})$$

2. **Apple Unified Memory Scoring:**
   - **Green:** $M_{req} \le (\text{Unified RAM} \times 0.75)$
   - **Yellow:** $(\text{Unified RAM} \times 0.75) < M_{req} \le (\text{Unified RAM} \times 0.90)$
   - **Red:** $M_{req} > (\text{Unified RAM} \times 0.90)$

3. **Discrete Memory (Windows/Linux) Scoring:**
   - **Green (Full GPU Offload):** $M_{req} \le \text{VRAM}$
   - **Yellow (Partial Offload / CPU RAM Swap):** $\text{VRAM} < M_{req} \le (\text{VRAM} + \text{System RAM} \times 0.70)$
   - **Red (Out of Memory):** $M_{req} > (\text{VRAM} + \text{System RAM} \times 0.70)$

---

## 7. Step-by-Step Development Milestones

### Milestone 1: Core Skeleton & Communication
- [x] Initialize Tauri v2 + React TypeScript scaffold.
- [x] Configure Python FastAPI backend running on `http://127.0.0.1:8000`.
- [x] Implement `/api/health` check endpoint and display status on React frontend.

### Milestone 2: Hardware Detection & Profile Management
- [ ] Implement backend service `hardware_detector.py` using `psutil` and `platform`.
- [ ] Set up SQLite DB schema via SQLModel in `database.py`.
- [ ] Seed default hardware profiles (MacBook Air 24GB, Mac Mini 64GB, Gaming Rig 128GB+16GB VRAM).
- [ ] Create UI view `HardwareProfiles.tsx` allowing users to switch active profile and view current system specs.

### Milestone 3: Local Folder Ingestion & Auto-Tagging
- [ ] Create API endpoint `POST /api/inventory/scan` that accepts folder paths.
- [ ] Build recursive folder parser in Python scanning for `.gguf`, `.safetensors`, `.bin`, `.onnx`.
- [ ] Implement path-based capability detection:
  - Folder names containing `Vision` -> tag as **Vision**
  - Folder names containing `Coding` -> tag as **Coding**
  - Folder names containing `LLM` -> tag as **LLM**
- [ ] Store scanned files in SQLite `localinventory` table and render them in a `LocalLibrary.tsx` React component.

### Milestone 4: Hugging Face Discovery & Search
- [ ] Implement `huggingface.py` provider service using `huggingface_hub`.
- [ ] Create endpoint `GET /api/discover/search?query={query}&capability={tag}`.
- [ ] Parse repository files, group quantizations by family, and compute file sizes.
- [ ] Build React component `Discover.tsx` featuring search inputs, category filter pills (LLM, Vision, Coding), and model cards.

### Milestone 5: Hardware Compatibility Rating UI
- [ ] Integrate `compatibility_engine.py` into search and library endpoints.
- [ ] Annotate each model/quantization variant with a compatibility score based on the currently active `HardwareProfile`.
- [ ] Add LM Studio-style traffic light indicator badges (**Green: Runs Great**, **Yellow: Runs Slow/Partial Offload**, **Red: Incompatible**) to each model card.

### Milestone 6: Download & Launcher Integration
- [ ] Add direct file download functionality via Python backend (`httpx` or `requests` with progress tracking).
- [ ] Implement copy-to-clipboard file path exporter for external runners (Ollama, llama.cpp, LM Studio, KoboldCpp).

---

## Instructions for Claude Code Execution

When asking **Claude Code** to work on this project, issue commands step-by-step using these prompts:

1. **For Milestone 2:**
   > "Read `PROJECT_PLAN.md`. Implement Milestone 2: Create the SQLite database schemas in `backend/models/`, implement `hardware_detector.py`, seed the three hardware profiles, and build the React `HardwareProfiles.tsx` UI to let the user switch active profiles."

2. **For Milestone 3:**
   > "Read `PROJECT_PLAN.md`. Implement Milestone 3: Create the local folder scanner service in Python to recursively find GGUF/Safetensors files, auto-tag them based on folder path rules (Vision, Coding, LLM), save them to SQLite, and display them in a `LocalLibrary.tsx` view."

3. **For Milestone 4 & 5:**
   > "Read `PROJECT_PLAN.md`. Implement Milestones 4 & 5: Connect Hugging Face search API in Python, apply the VRAM compatibility scoring logic against the active Hardware Profile, and render the model cards in React with LM Studio-style Green/Yellow/Red indicators."
