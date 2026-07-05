from pathlib import Path
import argparse
import json

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from transformers import AutoModelForCTC, AutoProcessor

MODEL_ID = "skydheere/wav2vec2-large-mms-1b-somalia"


def load_model(model_id: str):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    processor = AutoProcessor.from_pretrained(model_id, local_files_only=True)
    model = AutoModelForCTC.from_pretrained(model_id, local_files_only=True).to(device)
    model.eval()
    return processor, model, device


def load_audio(audio_path: Path, target_sample_rate: int = 16000) -> np.ndarray:
    audio_array, sample_rate = sf.read(str(audio_path), always_2d=False)

    if audio_array.ndim > 1:
        audio_array = audio_array.mean(axis=1)

    audio_array = audio_array.astype(np.float32)

    if sample_rate != target_sample_rate:
        audio_array = resample_poly(audio_array, target_sample_rate, sample_rate).astype(np.float32)

    return audio_array


def chunk_audio(audio_array, sample_rate: int, chunk_seconds: int):
    chunk_size = sample_rate * chunk_seconds
    for start in range(0, len(audio_array), chunk_size):
        yield start // sample_rate, audio_array[start : start + chunk_size]


def transcribe_chunks(audio_path: Path, model_id: str, chunk_seconds: int) -> dict:
    if not audio_path.exists():
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    processor, model, device = load_model(model_id)
    audio_array = load_audio(audio_path, target_sample_rate=16000)

    chunks = []
    texts = []

    for offset_seconds, chunk in chunk_audio(audio_array, 16000, chunk_seconds):
        if len(chunk) == 0:
            continue

        inputs = processor(
            chunk,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        )
        inputs = {key: value.to(device) for key, value in inputs.items()}

        with torch.no_grad():
            logits = model(**inputs).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        text = processor.batch_decode(predicted_ids)[0].strip()
        texts.append(text)
        chunks.append({"offset_seconds": offset_seconds, "text": text})

    return {
        "file": str(audio_path),
        "model": model_id,
        "device": device,
        "chunk_seconds": chunk_seconds,
        "text": " ".join(texts).strip(),
        "chunks": chunks,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Chunk and transcribe long Somali audio recordings."
    )
    parser.add_argument("audio", help="Path to the audio file to transcribe.")
    parser.add_argument(
        "--chunk-seconds",
        type=int,
        default=20,
        help="Chunk size in seconds.",
    )
    parser.add_argument(
        "--model-id",
        default=MODEL_ID,
        help="Hugging Face model id to load.",
    )
    parser.add_argument(
        "--output",
        default="transcription_long.json",
        help="Where to write the JSON result.",
    )
    args = parser.parse_args()

    result = transcribe_chunks(Path(args.audio), args.model_id, args.chunk_seconds)
    print(result["text"])

    output_path = Path(args.output)
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Saved result to {output_path}")


if __name__ == "__main__":
    main()
