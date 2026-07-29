from typing import Any

from models.hardware import HardwareProfile


def score_compatibility(file_size_bytes: int, profile: HardwareProfile) -> dict[str, Any]:
    required_gb = (file_size_bytes / (1024 ** 3)) * 1.15

    if profile.is_unified_memory:
        total_gb = profile.total_ram_gb
        green_threshold = total_gb * 0.75
        yellow_threshold = total_gb * 0.90

        if required_gb <= green_threshold:
            status = "green"
        elif required_gb <= yellow_threshold:
            status = "yellow"
        else:
            status = "red"
    else:
        vram_gb = profile.total_vram_gb
        ram_gb = profile.total_ram_gb
        cpu_swap_threshold = vram_gb + ram_gb * 0.70

        if required_gb <= vram_gb:
            status = "green"
        elif required_gb <= cpu_swap_threshold:
            status = "yellow"
        else:
            status = "red"

    labels = {
        "green": "Runs Great",
        "yellow": "Runs Slow / Partial Offload",
        "red": "Incompatible",
    }

    return {
        "status": status,
        "label": labels[status],
        "required_memory_gb": round(required_gb, 2),
        "available_memory_gb": round(
            profile.total_ram_gb if profile.is_unified_memory else profile.total_vram_gb,
            2,
        ),
    }
