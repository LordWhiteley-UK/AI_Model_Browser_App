import os
import platform
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Any

SYSTEM = platform.system().lower()


@dataclass
class DetectedRunner:
    id: str
    name: str
    detected: bool
    binary_path: str | None = None
    version: str | None = None
    default_model_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "detected": self.detected,
            "binary_path": self.binary_path,
            "version": self.version,
            "default_model_path": self.default_model_path,
        }


def _which(command: str) -> str | None:
    return shutil.which(command)


def _run_version(binary_path: str, args: list[str]) -> str | None:
    try:
        result = subprocess.run(
            [binary_path, *args],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode == 0:
            return result.stdout.strip().splitlines()[0].strip()
    except Exception:
        pass
    return None


def _ollama_paths() -> list[str]:
    paths = []
    if SYSTEM == "darwin":
        paths.extend([
            "/usr/local/bin/ollama",
            "/opt/homebrew/bin/ollama",
            "/Applications/Ollama.app/Contents/MacOS/Ollama",
            str(Path.home() / "Applications/Ollama.app/Contents/MacOS/Ollama"),
        ])
    elif SYSTEM == "windows":
        paths.extend([
            str(Path.home() / "AppData/Local/Programs/Ollama/ollama.exe"),
            "C:/Program Files/Ollama/ollama.exe",
        ])
    else:
        paths.extend([
            "/usr/local/bin/ollama",
            "/usr/bin/ollama",
            "/opt/ollama/bin/ollama",
        ])
    return paths


def _lm_studio_paths() -> list[str]:
    paths = []
    if SYSTEM == "darwin":
        paths.extend([
            "/Applications/LM Studio.app",
            str(Path.home() / "Applications/LM Studio.app"),
        ])
    elif SYSTEM == "windows":
        paths.extend([
            str(Path.home() / "AppData/Local/LM-Studio/LM Studio.exe"),
            "C:/Program Files/LM-Studio/LM Studio.exe",
        ])
    return paths


def _llama_cpp_paths() -> list[str]:
    return []


def _ollama_default_model_path() -> str | None:
    if SYSTEM == "darwin":
        return str(Path.home() / ".ollama/models")
    elif SYSTEM == "linux":
        return "/usr/share/ollama/.ollama/models"
    elif SYSTEM == "windows":
        return str(Path.home() / ".ollama/models")
    return None


def _lm_studio_default_model_path() -> str | None:
    if SYSTEM == "darwin":
        return str(Path.home() / "Downloads/LM Studio Models")
    elif SYSTEM == "windows":
        return str(Path.home() / "AppData/Local/LM-Studio/models")
    return None


def _find_existing(paths: list[str]) -> str | None:
    for p in paths:
        if Path(p).exists():
            return p
    return None


def detect_ollama() -> DetectedRunner:
    binary = _which("ollama")
    if not binary:
        binary = _find_existing(_ollama_paths())

    version = None
    if binary:
        version = _run_version(binary, ["--version"])

    return DetectedRunner(
        id="ollama",
        name="Ollama",
        detected=binary is not None,
        binary_path=binary,
        version=version,
        default_model_path=_ollama_default_model_path(),
    )


def detect_lm_studio() -> DetectedRunner:
    app_path = _find_existing(_lm_studio_paths())

    config_model_path = None
    if app_path and SYSTEM == "darwin":
        # Try to read LM Studio's config from common locations.
        candidates = [
            Path.home() / "Library/Application Support/LM Studio/config.json",
            Path.home() / ".lmstudio/config.json",
        ]
        for candidate in candidates:
            if candidate.exists():
                try:
                    import json

                    data = json.loads(candidate.read_text())
                    configured = data.get("modelDownloadPath") or data.get("modelsDir")
                    if configured:
                        config_model_path = str(Path(configured).expanduser())
                        break
                except Exception:
                    pass

    return DetectedRunner(
        id="lm_studio",
        name="LM Studio",
        detected=app_path is not None,
        binary_path=app_path,
        version=None,
        default_model_path=config_model_path or _lm_studio_default_model_path(),
    )


def detect_llama_cpp() -> DetectedRunner:
    binary = _which("llama-server") or _which("llama-cli") or _which("main")
    return DetectedRunner(
        id="llama_cpp",
        name="llama.cpp",
        detected=binary is not None,
        binary_path=binary,
        version=None,
        default_model_path=None,
    )


def detect_all_runners() -> list[DetectedRunner]:
    return [
        detect_ollama(),
        detect_lm_studio(),
        detect_llama_cpp(),
    ]


def apply_overrides(
    runners: list[DetectedRunner], overrides: dict[str, dict[str, str | None]]
) -> list[DetectedRunner]:
    for runner in runners:
        override = overrides.get(runner.id)
        if not override:
            continue
        if override.get("binary_path"):
            runner.binary_path = override["binary_path"]
            runner.detected = True
        if override.get("model_path"):
            runner.default_model_path = override["model_path"]
    return runners
