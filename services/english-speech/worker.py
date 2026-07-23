"""RunPod worker for English Whisper Turbo STT and Kokoro TTS."""
from __future__ import annotations

import base64
import io
import os
import tempfile
import time
from pathlib import Path
from typing import Any

import av
import numpy as np
import soundfile as sf
import torch
from scipy.signal import resample_poly
from faster_whisper import WhisperModel
from kokoro import KPipeline

WHISPER_MODEL_ID = os.getenv("ENGLISH_ASR_MODEL_ID", "large-v3-turbo")
KOKORO_VOICE = os.getenv("KOKORO_VOICE", "af_heart")
MAX_AUDIO_BYTES = int(os.getenv("ENGLISH_ASR_MAX_BYTES", str(30 * 1024 * 1024)))
MAX_AUDIO_SECONDS = int(os.getenv("ENGLISH_ASR_MAX_SECONDS", "180"))
MAX_TTS_CHARS = int(os.getenv("ENGLISH_TTS_MAX_CHARS", "1000"))
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "float16" if DEVICE == "cuda" else "int8")

asr_model: WhisperModel | None = None
tts_pipeline: KPipeline | None = None

def load_asr() -> WhisperModel:
    global asr_model
    if asr_model is None:
        asr_model = WhisperModel(WHISPER_MODEL_ID, device=DEVICE, compute_type=COMPUTE_TYPE)
    return asr_model

def load_tts() -> KPipeline:
    global tts_pipeline
    if tts_pipeline is None:
        tts_pipeline = KPipeline(lang_code="a")
    return tts_pipeline

def decode_audio(audio_bytes: bytes, suffix: str) -> tuple[np.ndarray, int]:
    if not audio_bytes or len(audio_bytes) > MAX_AUDIO_BYTES:
        raise ValueError("Audio is missing or exceeds the configured size limit")
    with tempfile.NamedTemporaryFile(suffix=suffix or ".webm") as tmp:
        tmp.write(audio_bytes)
        tmp.flush()
        container = av.open(tmp.name)
        stream = container.streams.audio[0] if container.streams.audio else None
        if stream is None:
            raise ValueError("No audio stream found")
        frames = [frame.to_ndarray() for frame in container.decode(stream)]
        rate = stream.rate or 16000
    if not frames:
        raise ValueError("No audio samples found")
    samples = np.concatenate(frames, axis=-1).mean(axis=0).astype(np.float32)
    if samples.size / rate > MAX_AUDIO_SECONDS:
        raise ValueError("Audio exceeds the configured duration limit")
    if rate != 16000:
        samples = resample_poly(samples, 16000, rate).astype(np.float32)
        rate = 16000
    return samples, rate

def transcribe(payload: dict[str, Any]) -> dict[str, Any]:
    started = time.perf_counter()
    encoded = payload.get("audio_data")
    if not encoded:
        return {"error": "Missing audio_data"}
    audio, rate = decode_audio(base64.b64decode(encoded), Path(payload.get("filename", "audio.webm")).suffix)
    segments, info = load_asr().transcribe(audio, language="en", task="transcribe", beam_size=5, vad_filter=True)
    text = " ".join(segment.text.strip() for segment in segments).strip()
    return {"transcription": text, "model": WHISPER_MODEL_ID, "language": "en", "timing": {"totalMs": round((time.perf_counter()-started)*1000, 1), "durationSeconds": round(info.duration, 2)}}

def synthesize(payload: dict[str, Any]) -> dict[str, Any]:
    text = " ".join(str(payload.get("text") or "").split())
    if not text:
        return {"error": "Missing text"}
    if len(text) > MAX_TTS_CHARS:
        return {"error": f"Text exceeds the {MAX_TTS_CHARS} character limit"}
    started = time.perf_counter()
    voice = str(payload.get("voice") or KOKORO_VOICE)
    audio = np.concatenate([part for _, _, part in load_tts()(text, voice=voice)])
    buffer = io.BytesIO()
    sf.write(buffer, audio, 24000, format="WAV", subtype="PCM_16")
    wav = buffer.getvalue()
    return {"audio_data": base64.b64encode(wav).decode(), "content_type": "audio/wav", "sample_rate": 24000, "model": "hexgrad/Kokoro-82M", "voice": voice, "timing": {"totalMs": round((time.perf_counter()-started)*1000, 1)}}

def dispatch(job: dict[str, Any]) -> dict[str, Any]:
    payload = job.get("input", job)
    try:
        action = str(payload.get("action", "health")).lower()
        if action == "transcribe": return transcribe(payload)
        if action == "synthesize": return synthesize(payload)
        if action == "warmup":
            service = str(payload.get("service", "all")).lower()
            if service in {"all", "asr", "english_asr"}: load_asr()
            if service in {"all", "tts", "english_tts"}: load_tts()
            return {"status": "ready", "models": {"english_asr": WHISPER_MODEL_ID if asr_model else "not_loaded", "english_tts": "hexgrad/Kokoro-82M" if tts_pipeline else "not_loaded"}}
        if action == "health": return {"status": "ok", "device": DEVICE, "english_asr_model": WHISPER_MODEL_ID if asr_model else "not_loaded", "english_tts_model": "hexgrad/Kokoro-82M" if tts_pipeline else "not_loaded"}
        return {"error": f"Unknown action: {action}"}
    except Exception as exc:
        return {"error": str(exc)}
