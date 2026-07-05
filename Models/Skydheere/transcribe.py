from pathlib import Path
import argparse
import json
import os

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from transformers import AutoModelForCTC, AutoProcessor

MODEL_ID = "skydheere/wav2vec2-large-mms-1b-somalia"

# Singleton cache — load once per model_id, reuse across requests
_model_cache: dict[str, tuple] = {}


def local_files_only() -> bool:
    return os.environ.get("ASR_LOCAL_FILES_ONLY", "false").lower() in ("1", "true", "yes")


def load_model(model_id: str):
    if model_id in _model_cache:
        return _model_cache[model_id]

    device = "cuda" if torch.cuda.is_available() else "cpu"
    offline = local_files_only()
    processor = AutoProcessor.from_pretrained(model_id, local_files_only=offline)
    model = AutoModelForCTC.from_pretrained(model_id, local_files_only=offline).to(device)
    model.eval()
    _model_cache[model_id] = (processor, model, device)
    return _model_cache[model_id]


def _load_audio_av(audio_path: Path) -> tuple[np.ndarray, int]:
    """Decode webm/opus/m4a and other formats that soundfile cannot read."""
    import av

    container = av.open(str(audio_path))
    try:
        if not container.streams.audio:
            raise ValueError(f"No audio stream in {audio_path.name}")

        stream = container.streams.audio[0]
        samples: list[np.ndarray] = []
        for frame in container.decode(audio=0):
            arr = frame.to_ndarray()
            if arr.dtype == np.int16:
                arr = arr.astype(np.float32) / 32768.0
            elif arr.dtype == np.int32:
                arr = arr.astype(np.float32) / 2147483648.0
            else:
                arr = arr.astype(np.float32)
            if arr.ndim > 1:
                arr = arr.mean(axis=0)
            samples.append(arr)

        if not samples:
            raise ValueError(f"Could not decode audio from {audio_path.name}")

        audio_array = np.concatenate(samples)
        sample_rate = int(stream.codec_context.sample_rate or stream.rate or 16000)
        return audio_array, sample_rate
    finally:
        container.close()


def load_audio(audio_path: Path, target_sample_rate: int = 16000) -> np.ndarray:
    suffix = audio_path.suffix.lower()
    use_av_first = suffix in {".webm", ".opus", ".ogg", ".m4a", ".mp4", ".mp3", ".aac"}

    audio_array: np.ndarray
    sample_rate: int

    if use_av_first:
        audio_array, sample_rate = _load_audio_av(audio_path)
    else:
        try:
            audio_array, sample_rate = sf.read(str(audio_path), always_2d=False)
            if audio_array.ndim > 1:
                audio_array = audio_array.mean(axis=1)
            audio_array = audio_array.astype(np.float32)
        except Exception:
            audio_array, sample_rate = _load_audio_av(audio_path)

    if sample_rate != target_sample_rate:
        audio_array = resample_poly(audio_array, target_sample_rate, sample_rate).astype(np.float32)

    return audio_array


def transcribe_file(audio_path: Path, model_id: str) -> dict:
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    processor, model, device = load_model(model_id)

    audio_array = load_audio(audio_path, target_sample_rate=16000)
    inputs = processor(
        audio_array,
        sampling_rate=16000,
        return_tensors="pt",
        padding=True,
    )
    inputs = {key: value.to(device) for key, value in inputs.items()}

    with torch.no_grad():
        logits = model(**inputs).logits

    predicted_ids = torch.argmax(logits, dim=-1)
    text = processor.batch_decode(predicted_ids)[0]

    return {
        "file": str(audio_path),
        "model": model_id,
        "device": device,
        "text": text,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Transcribe Somali audio with skydheere/wav2vec2-large-mms-1b-somalia."
    )
    parser.add_argument("audio", help="Path to the audio file to transcribe.")
    parser.add_argument(
        "--model-id",
        default=MODEL_ID,
        help="Hugging Face model id to load.",
    )
    parser.add_argument(
        "--output",
        default="transcription.json",
        help="Where to write the JSON result.",
    )
    args = parser.parse_args()

    result = transcribe_file(Path(args.audio), args.model_id)
    print(result["text"])

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved result to {output_path}")


if __name__ == "__main__":
    main()
