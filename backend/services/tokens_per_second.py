"""Token-per-second prediction engine for local LLM inference.

Generation (autoregressive decoding) is memory-bandwidth bound for quantized
models. Prefill (prompt processing) is compute bound. We estimate both and
return the more realistic bottlenecked numbers.
"""

from typing import Any

from data.hardware_specs import DEFAULTS, lookup_hardware_specs
from models.hardware import HardwareProfile


# Real-world llama.cpp/ollama generation throughput is typically 60-75% of peak
# memory bandwidth. We use a conservative 0.65 factor.
GENERATION_BANDWIDTH_EFFICIENCY = 0.65

# Discrete-GPU prefill is usually compute-bound; we assume 35% of peak FP16
# TFLOPS is usable for prompt processing.
PREFILL_COMPUTE_EFFICIENCY = 0.35

# CPU-only inference has poor memory parallelism for matrix workloads; use a
# much heavier penalty on system memory bandwidth.
CPU_BANDWIDTH_EFFICIENCY = 0.25

# Some overhead for KV cache, activations, and runner bookkeeping.
MEMORY_OVERHEAD_FACTOR = 1.15


def _quant_bits_from_method(quant_method: str | None) -> int | None:
    if not quant_method:
        return None
    q = quant_method.upper()
    if q.startswith("Q4") or q.startswith("IQ4") or "4BIT" in q:
        return 4
    if q.startswith("Q5") or q.startswith("IQ5"):
        return 5
    if q.startswith("Q6") or q.startswith("IQ6"):
        return 6
    if q.startswith("Q8") or q.startswith("IQ8"):
        return 8
    if q.startswith("Q2") or q.startswith("IQ2"):
        return 2
    if "16" in q or "F16" in q or "FP16" in q:
        return 16
    if "BF16" in q:
        return 16
    return None


def _effective_compute_tflops(profile: HardwareProfile) -> float:
    """Return a compute number that is appropriate for the hardware."""
    tflops = profile.gpu_compute_fp16_tflops or DEFAULTS["gpu_compute_fp16_tflops"]
    # Apple Silicon GPUs run matrix units at close to their advertised rate.
    if profile.is_unified_memory:
        return tflops
    # Discrete NVIDIA/AMD GPUs are penalized for prefill because actual
    # prompt-processing throughput is lower than peak Tensor/ROCm numbers.
    return tflops


def estimate_tokens_per_second(
    file_size_bytes: int,
    quant_method: str | None,
    params_billions: float | None,
    profile: HardwareProfile,
) -> dict[str, Any]:
    """Estimate generation and prefill token speed for a model file.

    Returns:
        {
            "generation_tok_s": float,
            "prefill_tok_s": float | None,
            "bottleneck": "memory" | "compute" | "unknown",
            "memory_bound": bool,
            "using_default_specs": bool,
            "effective_bandwidth_gbps": float,
        }
    """
    model_size_gb = file_size_bytes / (1024 ** 3)
    loaded_model_gb = model_size_gb * MEMORY_OVERHEAD_FACTOR

    # Decide whether the model will run on GPU VRAM or system RAM.
    # This is a heuristic; the compatibility engine is the authoritative
    # source of "fits in memory", but we can make a reasonable guess.
    fits_vram = not profile.is_unified_memory and loaded_model_gb <= profile.total_vram_gb
    runs_on_gpu = fits_vram or profile.is_unified_memory

    # Look up hardware specs if profile fields are blank.
    specs = lookup_hardware_specs(profile.cpu_name, profile.gpu_name, profile.is_unified_memory)
    using_defaults = (
        profile.memory_bandwidth_gbps is None
        and profile.vram_bandwidth_gbps is None
        and profile.gpu_compute_fp16_tflops is None
    )

    bandwidth_gbps: float
    if runs_on_gpu:
        bandwidth_gbps = profile.vram_bandwidth_gbps or specs.get("vram_bandwidth_gbps", DEFAULTS["vram_bandwidth_gbps"])
    else:
        bandwidth_gbps = profile.memory_bandwidth_gbps or specs.get("memory_bandwidth_gbps", DEFAULTS["memory_bandwidth_gbps"])

    # CPU-only path is much less efficient at using system memory bandwidth.
    efficiency = CPU_BANDWIDTH_EFFICIENCY if not runs_on_gpu else GENERATION_BANDWIDTH_EFFICIENCY
    # Some CPU entries in the lookup table provide their own efficiency hint.
    cpu_eff = specs.get("cpu_efficiency")
    if not runs_on_gpu and cpu_eff:
        efficiency = cpu_eff

    # bytes/token = model_size_GB * 1024**3 / (size_bytes * 8 / quant_bits)
    # Simpler: generation tok/s = bandwidth_GB/s / model_size_GB
    generation_tok_s = (bandwidth_gbps * efficiency) / loaded_model_gb

    # Prefill estimate: compute bound. Rough formula:
    #   FLOPs per token ≈ 2 * params
    #   tok/s = compute_FLOPS / (2 * params * context_len)
    # We use a 512-token prefill window as a representative prompt chunk.
    prefill_tok_s: float | None = None
    if params_billions:
        tflops = _effective_compute_tflops(profile) or specs.get("gpu_compute_fp16_tflops", DEFAULTS["gpu_compute_fp16_tflops"])
        flops = tflops * 1e12 * PREFILL_COMPUTE_EFFICIENCY
        params_total = params_billions * 1e9
        # Use a modest 512-token chunk to avoid unrealistic long-context numbers.
        prefill_window = 512
        prefill_tok_s = flops / (2 * params_total * prefill_window)

    bottleneck = "memory"
    if prefill_tok_s and prefill_tok_s < generation_tok_s:
        bottleneck = "compute"
    if not params_billions:
        bottleneck = "unknown"

    return {
        "generation_tok_s": round(max(generation_tok_s, 0.1), 1),
        "prefill_tok_s": round(prefill_tok_s, 1) if prefill_tok_s else None,
        "bottleneck": bottleneck,
        "memory_bound": bottleneck == "memory",
        "using_default_specs": using_defaults,
        "effective_bandwidth_gbps": round(bandwidth_gbps, 1),
    }


def attach_prediction_to_file(file: dict[str, Any], profile: HardwareProfile) -> None:
    """Mutate a file dict to add a prediction key."""
    prediction = estimate_tokens_per_second(
        file_size_bytes=file.get("size_bytes", 0),
        quant_method=file.get("quant_method"),
        params_billions=file.get("params_billions"),
        profile=profile,
    )
    file["prediction"] = prediction
