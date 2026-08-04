# Plan: Add token-per-second prediction to AI Model Browser

## Goal
Show users an estimated inference speed (tokens/second) for each model file, based on their active hardware profile. Display it alongside the existing compatibility badge in Discover and Local Library.

## Why this design
- Local quantized LLM inference is overwhelmingly **memory-bandwidth bound** during generation and **compute bound** during prompt processing (prefill). We need both numbers.
- We can’t reliably auto-detect memory bandwidth or GPU TFLOPS, so we add a small seed/lookup table keyed by common Apple / NVIDIA / AMD / Intel chip names.
- We extend the existing `HardwareProfile` with the minimum extra fields needed (bandwidth, compute), and auto-fill them from the lookup table when a profile is created or detected.
- We add a new backend service `tokens_per_second.py` and attach predictions to the same endpoints that already serve compatibility scores, so the frontend change is minimal.

## Files to modify / create

### Backend

1. **`backend/data/hardware_specs.py` (new)**
   - A Python module containing lookup tables:
     - `APPLE_SILICON_SPECS`: chip name → memory_bandwidth_gbps, tflops_fp16.
     - `NVIDIA_GPU_SPECS`: name → vram_bandwidth_gbps, tflops_fp16.
     - `AMD_GPU_SPECS`, `INTEL_GPU_SPECS`: same shape.
   - A helper `lookup_hardware_specs(cpu_name, gpu_name) -> dict` that returns the best matching bandwidth/TFLOPS values (or conservative defaults if unknown).

2. **`backend/models/hardware.py`**
   - Add optional fields:
     - `memory_bandwidth_gbps` (system memory bandwidth, used for CPU/APU inference)
     - `vram_bandwidth_gbps` (VRAM bandwidth for discrete GPU inference)
     - `gpu_compute_fp16_tflops` (compute for prefill estimate)
   - Update `__tablename__` migration in `database.py` to add these columns if missing.

3. **`backend/database.py`**
   - Extend `_migrate_hardware_profile_columns()` to add the three new columns if missing.

4. **`backend/services/tokens_per_second.py` (new)**
   - Function `estimate_tokens_per_second(file_size_bytes, params_billions, quant_bits, profile: HardwareProfile) -> dict`:
     - Compute `model_size_gb = file_size_bytes / (1024**3)`.
     - Pick effective bandwidth: `vram_bandwidth_gbps` if discrete GPU and fits in VRAM, else `memory_bandwidth_gbps`.
     - Generation estimate: `effective_bandwidth_gbps * 1.15 (overhead factor) / model_size_gb`.
     - Prefill estimate (if `params_billions` and `gpu_compute_fp16_tflops` available): `compute_tflops * 1e12 / (2 * params_billions * 1e9)`.
     - Apply a conservative CPU efficiency factor when no discrete GPU is detected.
     - Return: `generation_tok_s`, `prefill_tok_s`, `memory_bound`, `bottleneck`.

5. **`backend/main.py`**
   - Import `estimate_tokens_per_second`.
   - Extend `CreateProfileRequest` to accept the new optional fields.
   - In `create_profile`, use `lookup_hardware_specs` to auto-fill bandwidth/TFLOPS when the user doesn’t provide them.
   - In `/api/discover/search`, attach `prediction` next to `compatibility` for every file.
   - Add endpoint `GET /api/inventory/{item_id}/prediction` that returns the prediction for a local file (optional, can be used by Local Library launcher modal).
   - Extend `/api/hardware/system` response to include estimated bandwidth/TFLOPS from the lookup table.

6. **`backend/providers/huggingface.py`**
   - Improve `params_billions` inference by parsing common model-card or repo-name patterns (e.g. `7B`, `13B`, `70B`, `Qwen2-7B`). Currently hardcoded to `None`.
   - Add `quant_bits` inference from `quant_method` (e.g. `Q4_K_M` → 4, `Q8_0` → 8). The estimator will use `size_bytes` primarily, but params + quant helps sanity-check.

### Frontend

7. **`frontend/src/types/index.ts`**
   - Add `prediction?: TokenPrediction` to `ModelFile`.
   - Add `interface TokenPrediction { generation_tok_s: number; prefill_tok_s: number; memory_bound: boolean; bottleneck: string; }`.
   - Extend `HardwareProfile` with the three new optional fields.

8. **`frontend/src/api/client.ts`**
   - Optionally add `getPrediction(itemId)` helper.

9. **`frontend/src/views/Discover.tsx`**
   - Display predicted speed next to `CompatibilityBadge` on each file row, with a tooltip like “Generation: ~X tok/s, Prefill: ~Y tok/s on active profile.”
   - Use a small `Gauge` or `Zap` icon.
   - Show an info note when the prediction is based on conservative defaults because the hardware profile lacks bandwidth data.

10. **`frontend/src/views/HardwareProfiles.tsx`**
    - Add read-only display of `memory_bandwidth_gbps` / `vram_bandwidth_gbps` / `gpu_compute_fp16_tflops` on saved profiles and the detected-system panel.
    - When the detected system panel shows these values, offer an “Use detected bandwidth estimate” button when creating a new profile.

## Data sources to seed

We will gather public spec numbers for the chips already in the frontend pick-lists:
- Apple M1/M1 Pro/M1 Max/M2/M2 Pro/M2 Max/M3/M3 Pro/M3 Max/M4/M4 Pro/M4 Max memory bandwidth and GPU TFLOPS.
- NVIDIA RTX 3060/4060/4070/4080/4090/5070/5080/5090 VRAM bandwidth and FP16 TFLOPS.
- AMD RX 7900 XT/XTX VRAM bandwidth and compute.
- Common Intel desktop chips (i5-13600K, i7-14700K, i9-14900K) approximate system memory bandwidth.
- AMD Ryzen 7000/9000 series approximate memory bandwidth.

We will use conservative, widely published figures (not peak marketing numbers) because real llama.cpp throughput is usually 50–80% of theoretical bandwidth.

## Out of scope for this first pass
- Accurate per-layer benchmark collection.
- Runner-specific tuning (llama.cpp vs Ollama overhead differences).
- Measuring actual token speed at runtime (that could be a follow-up).

## Success criteria
- Every model file in Discover shows a predicted `~X tok/s` generation speed.
- The prediction updates when the user switches active hardware profile.
- Creating a new hardware profile auto-fills bandwidth/TFLOPS for known chips.
- The feature works without breaking existing compatibility scoring.
