import os
from typing import Any

SUPPORTED_RUNNERS = {
    "ollama": "Ollama",
    "llama_cpp": "llama.cpp",
    "lm_studio": "LM Studio",
    "koboldcpp": "KoboldCpp",
    "vllm": "vLLM",
}


def _quote(path: str) -> str:
    return f"'{path}'"


def _model_name_from_path(path: str) -> str:
    filename = os.path.basename(path)
    name, _ = os.path.splitext(filename)
    return name.lower().replace(" ", "-").replace("_", "-")


def build_launcher_command(runner: str, local_path: str) -> dict[str, Any]:
    if runner not in SUPPORTED_RUNNERS:
        raise ValueError(f"Unsupported runner: {runner}")

    path = local_path
    quoted = _quote(path)
    model_name = _model_name_from_path(path)

    commands = {
        "ollama": (
            f"cat > {model_name}.Modelfile <<'EOF'\n"
            f"FROM {path}\n"
            f"EOF\n"
            f"ollama create {model_name} -f {model_name}.Modelfile\n"
            f"ollama run {model_name}"
        ),
        "llama_cpp": (
            f"./llama-server -m {quoted} -n 512 --host 127.0.0.1 --port 8080"
        ),
        "lm_studio": (
            f"# In LM Studio: My Models -> Add model -> select {quoted}"
        ),
        "koboldcpp": (
            f"./koboldcpp {quoted} --usecublas --gpulayers 100 --port 5001"
        ),
        "vllm": (
            f"vllm serve {quoted} --dtype auto --max-model-len 4096"
        ),
    }

    return {
        "runner": runner,
        "runner_name": SUPPORTED_RUNNERS[runner],
        "local_path": local_path,
        "command": commands[runner],
    }
