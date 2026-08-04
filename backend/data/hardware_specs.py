"""Conservative hardware bandwidth and compute lookup tables.

Values are taken from public product specifications and then rounded down to
reflect real-world local LLM inference efficiency (typically 50-80% of peak
memory bandwidth for autoregressive token generation).

Sources (retrieved 2026-08-03):
- Apple tech specs and whitepapers
- NVIDIA GeForce RTX 40/50-series product pages and architecture whitepapers
- AMD Radeon RX 7000-series product pages
- Intel ARK / product datasheets
- AMD Ryzen / Intel desktop platform memory specs
"""

from typing import Any

# Memory bandwidth is the dominant bottleneck for quantized LLM generation.
# These numbers are peak published bandwidth, but the estimator applies an
# additional efficiency factor so users see plausible real-world speeds.
APPLE_SILICON_SPECS: dict[str, dict[str, float]] = {
    # M1 generation
    "Apple M1": {"memory_bandwidth_gbps": 68.0, "gpu_compute_fp16_tflops": 5.3},
    "Apple M1 Pro": {"memory_bandwidth_gbps": 200.0, "gpu_compute_fp16_tflops": 10.6},
    "Apple M1 Max": {"memory_bandwidth_gbps": 400.0, "gpu_compute_fp16_tflops": 21.0},
    # M2 generation
    "Apple M2": {"memory_bandwidth_gbps": 100.0, "gpu_compute_fp16_tflops": 7.5},
    "Apple M2 Pro": {"memory_bandwidth_gbps": 200.0, "gpu_compute_fp16_tflops": 14.0},
    "Apple M2 Max": {"memory_bandwidth_gbps": 400.0, "gpu_compute_fp16_tflops": 27.0},
    "Apple M2 Ultra": {"memory_bandwidth_gbps": 800.0, "gpu_compute_fp16_tflops": 45.0},
    # M3 generation
    "Apple M3": {"memory_bandwidth_gbps": 100.0, "gpu_compute_fp16_tflops": 9.0},
    "Apple M3 Pro": {"memory_bandwidth_gbps": 150.0, "gpu_compute_fp16_tflops": 18.0},
    "Apple M3 Max": {"memory_bandwidth_gbps": 400.0, "gpu_compute_fp16_tflops": 32.0},
    # M4 generation
    "Apple M4": {"memory_bandwidth_gbps": 120.0, "gpu_compute_fp16_tflops": 11.0},
    "Apple M4 Pro": {"memory_bandwidth_gbps": 273.0, "gpu_compute_fp16_tflops": 25.0},
    "Apple M4 Max": {"memory_bandwidth_gbps": 546.0, "gpu_compute_fp16_tflops": 45.0},
}

NVIDIA_GPU_SPECS: dict[str, dict[str, float]] = {
    # 30-series
    "NVIDIA RTX 3060 (12 GB)": {
        "vram_bandwidth_gbps": 360.0,
        "gpu_compute_fp16_tflops": 51.0,
    },
    # 40-series
    "NVIDIA RTX 4060 (8 GB)": {
        "vram_bandwidth_gbps": 272.0,
        "gpu_compute_fp16_tflops": 60.0,
    },
    "NVIDIA RTX 4070 (12 GB)": {
        "vram_bandwidth_gbps": 504.0,
        "gpu_compute_fp16_tflops": 117.0,
    },
    "NVIDIA RTX 4080 (16 GB)": {
        "vram_bandwidth_gbps": 717.0,
        "gpu_compute_fp16_tflops": 195.0,
    },
    "NVIDIA RTX 4090 (24 GB)": {
        "vram_bandwidth_gbps": 1008.0,
        "gpu_compute_fp16_tflops": 330.0,
    },
    # 50-series (estimated from launch specs, conservative)
    "NVIDIA RTX 5070 (12 GB)": {
        "vram_bandwidth_gbps": 672.0,
        "gpu_compute_fp16_tflops": 140.0,
    },
    "NVIDIA RTX 5080 (16 GB)": {
        "vram_bandwidth_gbps": 960.0,
        "gpu_compute_fp16_tflops": 250.0,
    },
    "NVIDIA RTX 5090 (24 GB)": {
        "vram_bandwidth_gbps": 1792.0,
        "gpu_compute_fp16_tflops": 450.0,
    },
}

AMD_GPU_SPECS: dict[str, dict[str, float]] = {
    "AMD RX 7900 XT (20 GB)": {
        "vram_bandwidth_gbps": 800.0,
        "gpu_compute_fp16_tflops": 103.0,
    },
    "AMD RX 7900 XTX (24 GB)": {
        "vram_bandwidth_gbps": 960.0,
        "gpu_compute_fp16_tflops": 123.0,
    },
}

INTEL_GPU_SPECS: dict[str, dict[str, float]] = {
    # Intel Arc discrete GPUs (rough llama.cpp-relevant numbers)
    "Intel Arc A770 (16 GB)": {
        "vram_bandwidth_gbps": 512.0,
        "gpu_compute_fp16_tflops": 70.0,
    },
    "Intel Arc A750 (8 GB)": {
        "vram_bandwidth_gbps": 406.0,
        "gpu_compute_fp16_tflops": 55.0,
    },
}

CPU_MEMORY_SPECS: dict[str, dict[str, float]] = {
    # Approximate dual-channel DDR4/DDR5 bandwidth for common desktop CPUs.
    # Used as a fallback when the GPU is integrated/no-GPU and CPU inference
    # is expected.
    "Intel Core i5-13600K": {"memory_bandwidth_gbps": 90.0, "cpu_efficiency": 0.25},
    "Intel Core i7-14700K": {"memory_bandwidth_gbps": 90.0, "cpu_efficiency": 0.25},
    "Intel Core i9-14900K": {"memory_bandwidth_gbps": 90.0, "cpu_efficiency": 0.25},
    "AMD Ryzen 5 7600X": {"memory_bandwidth_gbps": 78.0, "cpu_efficiency": 0.25},
    "AMD Ryzen 7 7800X3D": {"memory_bandwidth_gbps": 78.0, "cpu_efficiency": 0.20},
    "AMD Ryzen 9 7950X": {"memory_bandwidth_gbps": 83.0, "cpu_efficiency": 0.25},
    "AMD Ryzen 9 9950X": {"memory_bandwidth_gbps": 83.0, "cpu_efficiency": 0.25},
}

# Generic defaults when a chip is not in the tables.
DEFAULTS: dict[str, float] = {
    "memory_bandwidth_gbps": 25.0,
    "vram_bandwidth_gbps": 200.0,
    "gpu_compute_fp16_tflops": 10.0,
}


def _best_match(name: str | None, table: dict[str, dict[str, float]]) -> dict[str, float] | None:
    if not name:
        return None
    normalized = name.strip().lower()
    # Exact match first.
    for key in table:
        if key.lower() == normalized:
            return table[key]
    # Substring match on the most specific identifier.
    for key in table:
        if key.lower() in normalized:
            return table[key]
    # Token overlap (e.g. "rtx 4090" inside a longer string).
    key_tokens = []
    for key in table:
        tokens = [t for t in key.lower().split() if len(t) > 1 and t not in {"gb", "(", ")"}]
        overlap = sum(1 for t in tokens if t in normalized)
        if overlap:
            key_tokens.append((overlap, key))
    if key_tokens:
        best = max(key_tokens, key=lambda x: x[0])[1]
        return table[best]
    return None


def lookup_hardware_specs(
    cpu_name: str | None,
    gpu_name: str | None,
    is_unified_memory: bool = False,
) -> dict[str, float]:
    """Return bandwidth/compute estimates for a CPU/GPU pair.

    The returned dict always contains:
      - memory_bandwidth_gbps
      - vram_bandwidth_gbps
      - gpu_compute_fp16_tflops
    """
    result: dict[str, float] = DEFAULTS.copy()

    # GPU lookup takes priority for discrete cards.
    gpu_match = (
        _best_match(gpu_name, NVIDIA_GPU_SPECS)
        or _best_match(gpu_name, AMD_GPU_SPECS)
        or _best_match(gpu_name, INTEL_GPU_SPECS)
    )
    if gpu_match:
        result.update(gpu_match)

    # CPU lookup mainly provides system memory bandwidth for CPU/APU inference.
    cpu_match = _best_match(cpu_name, CPU_MEMORY_SPECS)
    if cpu_match:
        result["memory_bandwidth_gbps"] = cpu_match["memory_bandwidth_gbps"]
        # Preserve CPU efficiency hint for the estimator.
        if "cpu_efficiency" in cpu_match:
            result["cpu_efficiency"] = cpu_match["cpu_efficiency"]

    # Apple Silicon: the GPU shares the unified memory pool, so VRAM bandwidth
    # is the same as system memory bandwidth and the GPU compute table wins.
    apple_match = _best_match(cpu_name, APPLE_SILICON_SPECS)
    if apple_match:
        result["memory_bandwidth_gbps"] = apple_match["memory_bandwidth_gbps"]
        result["vram_bandwidth_gbps"] = apple_match["memory_bandwidth_gbps"]
        result["gpu_compute_fp16_tflops"] = apple_match["gpu_compute_fp16_tflops"]

    return result


def fill_profile_specs(profile_dict: dict[str, Any]) -> dict[str, Any]:
    """Mutate a profile dict in place, adding bandwidth/compute fields if missing."""
    cpu = profile_dict.get("cpu_name") or profile_dict.get("cpu")
    gpu = profile_dict.get("gpu_name") or profile_dict.get("gpu")
    unified = profile_dict.get("is_unified_memory", False)
    specs = lookup_hardware_specs(cpu, gpu, is_unified_memory=unified)

    for key in ("memory_bandwidth_gbps", "vram_bandwidth_gbps", "gpu_compute_fp16_tflops"):
        if profile_dict.get(key) is None:
            profile_dict[key] = specs.get(key)

    return profile_dict
