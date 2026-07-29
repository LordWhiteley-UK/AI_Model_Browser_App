import json
import platform
import shutil
import subprocess
from typing import Any

import psutil


def _run_cmd(args: list[str]) -> str:
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        return result.stdout.strip()
    except Exception:
        return ""


def _get_cpu_name() -> str:
    system = platform.system()
    if system == "Darwin":
        output = _run_cmd(["sysctl", "-n", "machdep.cpu.brand_string"])
        if output:
            return output
    elif system == "Linux":
        output = _run_cmd(["grep", "model name", "/proc/cpuinfo"])
        if output:
            return output.splitlines()[0].split(":", 1)[-1].strip()
    elif system == "Windows":
        output = _run_cmd(["wmic", "cpu", "get", "Name", "/value"])
        if output:
            for line in output.splitlines():
                if line.startswith("Name="):
                    return line.split("=", 1)[-1].strip()
    return platform.processor() or "Unknown"


def _get_nvidia_vram_mb() -> tuple[float, str]:
    try:
        from pynvml import (
            nvmlDeviceGetCount,
            nvmlDeviceGetHandleByIndex,
            nvmlDeviceGetMemoryInfo,
            nvmlDeviceGetName,
            nvmlInit,
            nvmlShutdown,
        )

        nvmlInit()
        count = nvmlDeviceGetCount()
        total_vram_mb = 0.0
        names: list[str] = []
        for i in range(count):
            handle = nvmlDeviceGetHandleByIndex(i)
            mem = nvmlDeviceGetMemoryInfo(handle)
            total_vram_mb += mem.total / (1024 ** 2)
            name = nvmlDeviceGetName(handle)
            names.append(name.decode() if isinstance(name, bytes) else str(name))
        nvmlShutdown()
        return total_vram_mb, ", ".join(names) if names else "NVIDIA GPU"
    except Exception:
        return 0.0, ""


def _get_apple_gpu() -> tuple[float, str]:
    if not shutil.which("system_profiler"):
        return 0.0, ""

    try:
        output = _run_cmd(
            [
                "system_profiler",
                "SPDisplaysDataType",
                "-json",
            ]
        )
        data = json.loads(output)
        displays = data.get("SPDisplaysDataType", [])
        names: list[str] = []
        total_vram_mb = 0.0
        for display in displays:
            name = display.get("sppci_model", display.get("_name", "Apple GPU"))
            names.append(name)
            vram = display.get("spdisplays_vram", "")
            if isinstance(vram, str):
                vram = vram.lower().replace(",", "")
                if "gb" in vram:
                    try:
                        total_vram_mb += float(vram.replace("gb", "").strip()) * 1024
                    except ValueError:
                        pass
        return total_vram_mb, ", ".join(names) if names else "Apple GPU"
    except Exception:
        return 0.0, ""


def detect_system_specs() -> dict[str, Any]:
    system = platform.system()
    os_name = system
    if system == "Darwin":
        os_name = "macOS"
    elif system == "Windows":
        os_name = f"Windows {platform.release()}"
    elif system == "Linux":
        os_name = "Linux"

    cpu_name = _get_cpu_name()
    total_ram_gb = psutil.virtual_memory().total / (1024 ** 3)

    vram_mb, gpu_name = _get_nvidia_vram_mb()
    if not vram_mb and system == "Darwin":
        vram_mb, gpu_name = _get_apple_gpu()

    is_apple_silicon = system == "Darwin" and (
        "Apple" in cpu_name or cpu_name.startswith("Apple M")
    )
    is_unified = is_apple_silicon

    return {
        "os": os_name,
        "cpu_name": cpu_name,
        "total_ram_gb": round(total_ram_gb, 2),
        "total_vram_gb": round(vram_mb / 1024, 2),
        "gpu_name": gpu_name or None,
        "is_unified_memory": is_unified,
        "detected": True,
    }
