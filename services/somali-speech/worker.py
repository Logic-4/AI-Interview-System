"""
Somali ASR serverless worker for RunPod.
Handles speech-to-text (transcription) for Somali audio.
"""

from __future__ import annotations

import base64
import os
import tempfile
import time
import traceback
from pathlib import Path
from typing import Any, Dict

import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from transformers import AutoModelForCTC, AutoProcessor

# Paths and configuration
device = "cuda" if torch.cuda.is_available() else "cpu"
ASR_MODEL_ID = os.environ.get("ASR_MODEL_ID", "skydheere/wav2vec2-large-mms-1b-somalia")

# Singletons for memory efficiency
asr_processor = None
asr_model = None


def validate_cuda_runtime() -> Dict[str, Any]:
    """Launch a tiny kernel so incompatible images fail with useful diagnostics."""
    require_cuda = os.environ.get("REQUIRE_CUDA", "0").strip().lower() in {"1", "true", "yes"}
    if not torch.cuda.is_available():
        message = (
            "CUDA is unavailable. This production image requires a GPU; verify the "
            "RunPod GPU selection and NVIDIA container runtime."
        )
        if require_cuda:
            raise RuntimeError(message)
        print(f"CUDA startup probe skipped: {message}", flush=True)
        return {"available": False, "device": "cpu"}

    properties = torch.cuda.get_device_properties(0)
    capability = f"{properties.major}.{properties.minor}"
    compiled_arches = list(torch.cuda.get_arch_list())
    try:
        probe = torch.ones(1, device="cuda")
        probe.add_(1)
        torch.cuda.synchronize()
        del probe
    except Exception as exc:
        raise RuntimeError(
            "CUDA kernel startup probe failed. "
            f"GPU={properties.name!r}, capability={capability}, "
            f"torch={torch.__version__}, torch_cuda={torch.version.cuda}, "
            f"compiled_arches={compiled_arches}. Use a PyTorch build containing "
            "this GPU architecture or restrict the endpoint to a compatible GPU."
        ) from exc

    result = {
        "available": True,
        "gpu": properties.name,
        "capability": capability,
        "torch": torch.__version__,
        "torch_cuda": torch.version.cuda,
        "compiled_arches": compiled_arches,
    }
    print(f"CUDA startup probe passed: {result}", flush=True)
    return result


def load_asr() -> None:
    global asr_processor, asr_model
    if asr_model is not None:
        return
    print(f"Loading ASR model {ASR_MODEL_ID} on {device}…")
    asr_processor = AutoProcessor.from_pretrained(ASR_MODEL_ID)
    asr_model = AutoModelForCTC.from_pretrained(ASR_MODEL_ID).to(device)
    asr_model.eval()
    print("ASR model loaded successfully.")


def _load_audio_av(audio_path: Path) -> tuple[np.ndarray, int]:
    """Decode compressed formats (webm, opus, etc.) using PyAV."""
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


def handle_transcribe(payload: Dict[str, Any]) -> Dict[str, Any]:
    load_asr()
    audio_b64 = payload.get("audio_data")
    filename = payload.get("filename", "audio.webm")
    if not audio_b64:
        return {"error": "Missing audio_data in payload"}

    suffix = Path(filename).suffix or ".webm"
    audio_bytes = base64.b64decode(audio_b64)

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = Path(tmp.name)

    try:
        audio_array = load_audio(tmp_path, target_sample_rate=16000)
        inputs = asr_processor(
            audio_array,
            sampling_rate=16000,
            return_tensors="pt",
            padding=True,
        )
        inputs = {key: val.to(device) for key, val in inputs.items()}

        with torch.no_grad():
            logits = asr_model(**inputs).logits

        predicted_ids = torch.argmax(logits, dim=-1)
        text = asr_processor.batch_decode(predicted_ids)[0]
        return {
            "transcription": text,
            "model": ASR_MODEL_ID,
            "device": device,
        }
    except Exception as err:
        traceback.print_exc()
        return {"error": f"ASR failed: {str(err)}", "detail": traceback.format_exc()}
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def dispatch(payload: Dict[str, Any]) -> Dict[str, Any]:
    action = (payload.get("action") or "health").strip().lower()
    if action == "transcribe":
        return handle_transcribe(payload)
    elif action == "warmup":
        service = str(payload.get("service") or "asr").lower()
        started_at = time.perf_counter()
        if service in {"all", "interview", "asr", "somali_all"}:
            load_asr()
        else:
            return {"error": f"Unknown warmup service: {service}"}
        return {
            "status": "ready",
            "service": service,
            "load_ms": round((time.perf_counter() - started_at) * 1000, 1),
            "models": {
                "asr": ASR_MODEL_ID if asr_model is not None else "not_loaded",
            },
        }
    elif action == "health":
        return {
            "status": "ok",
            "device": device,
            "asr_model": ASR_MODEL_ID if asr_model is not None else "not_loaded",
        }
    else:
        return {"error": f"Unknown action: {action}"}
