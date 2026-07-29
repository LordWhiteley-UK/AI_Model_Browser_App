from typing import Any

SUPPORTED_RUNNERS = {
    "ollama": "Ollama",
    "llama_cpp": "llama.cpp",
    "lm_studio": "LM Studio",
    "koboldcpp": "KoboldCpp",
    "vllm": "vLLM",
}


def build_launcher_command(runner: str, local_path: str) -> dict[str, Any]:
    if runner not in SUPPORTED_RUNNERS:
        raise ValueError(f"Unsupported runner: {runner}")

    commands = {
        "ollama": f"# Add to Ollama Modelfile and load from {local_path}",
        "llama_cpp": f"./main -m '{local_path}' -n 128",
        "lm_studio": f"# Load model in LM Studio: {local_path}",
        "koboldcpp": f"# Select model in KoboldCpp UI: {local_path}",
        "vllm": f"vllm serve '{local_path}'",
    }

    return {
        "runner": runner,
        "runner_name": SUPPORTED_RUNNERS[runner],
        "local_path": local_path,
        "command": commands[runner],
    }
