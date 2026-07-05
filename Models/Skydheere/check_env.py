import importlib

packages = [
    "torch",
    "torchaudio",
    "transformers",
    "librosa",
    "soundfile",
    "datasets",
    "evaluate",
    "jiwer",
    "torchcodec",
    "accelerate",
    "huggingface_hub",
    "safetensors",
]


def main() -> None:
    for package in packages:
        try:
            module = importlib.import_module(package)
            version = getattr(module, "__version__", "unknown")
            print(f"{package}: {version}")
        except Exception as exc:
            print(f"{package}: ERROR - {exc}")

    try:
        import torch

        print(f"cuda_available: {torch.cuda.is_available()}")
        if torch.cuda.is_available():
            print(f"cuda_device: {torch.cuda.get_device_name(0)}")
    except Exception as exc:
        print(f"torch_runtime: ERROR - {exc}")


if __name__ == "__main__":
    main()
