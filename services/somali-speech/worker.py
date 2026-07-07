"""
Unified Somali and English ASR and TTS serverless worker for RunPod.
Handles speech-to-text (transcription) and text-to-speech (synthesis) for both Somali and English.
"""

from __future__ import annotations

import base64
import os
import tempfile
import traceback
from pathlib import Path
from typing import Any, Dict

import numpy as np
import scipy.io.wavfile
import soundfile as sf
import torch
from scipy.signal import resample_poly
try:
    from transformers import AutoModelForCTC, AutoProcessor, AutoTokenizer, VitsModel
except Exception as e:
    import traceback
    print("================== IMPORT DIAGNOSTIC ERROR ==================", flush=True)
    traceback.print_exc()
    print("=============================================================", flush=True)
    raise e

# Paths and configuration
device = "cuda" if torch.cuda.is_available() else "cpu"
ASR_MODEL_ID = os.environ.get("ASR_MODEL_ID", "skydheere/wav2vec2-large-mms-1b-somalia")
SOM_TTS_MODEL_ID = os.environ.get("SOM_TTS_MODEL_ID", "facebook/mms-tts-som")
ENG_TTS_MODEL_ID = os.environ.get("ENG_TTS_MODEL_ID", "facebook/mms-tts-eng")

# Singletons for memory efficiency
asr_processor = None
asr_model = None

som_tts_tokenizer = None
som_tts_model = None

eng_tts_tokenizer = None
eng_tts_model = None


def load_asr() -> None:
    global asr_processor, asr_model
    if asr_model is not None:
        return
    print(f"Loading ASR model {ASR_MODEL_ID} on {device}…")
    asr_processor = AutoProcessor.from_pretrained(ASR_MODEL_ID)
    asr_model = AutoModelForCTC.from_pretrained(ASR_MODEL_ID).to(device)
    asr_model.eval()
    print("ASR model loaded successfully.")


def load_som_tts() -> None:
    global som_tts_tokenizer, som_tts_model
    if som_tts_model is not None:
        return
    print(f"Loading Somali TTS model {SOM_TTS_MODEL_ID} on {device}…")
    som_tts_tokenizer = AutoTokenizer.from_pretrained(SOM_TTS_MODEL_ID)
    som_tts_model = VitsModel.from_pretrained(SOM_TTS_MODEL_ID).to(device)
    som_tts_model.eval()
    print("Somali TTS model loaded successfully.")


def load_eng_tts() -> None:
    global eng_tts_tokenizer, eng_tts_model
    if eng_tts_model is not None:
        return
    print(f"Loading English TTS model {ENG_TTS_MODEL_ID} on {device}…")
    eng_tts_tokenizer = AutoTokenizer.from_pretrained(ENG_TTS_MODEL_ID)
    eng_tts_model = VitsModel.from_pretrained(ENG_TTS_MODEL_ID).to(device)
    eng_tts_model.eval()
    print("English TTS model loaded successfully.")


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


def handle_synthesize(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = payload.get("text")
    if not text or not text.strip():
        return {"error": "Missing text in payload"}

    language = payload.get("language", "somali").strip().lower()

    if language == "english":
        load_eng_tts()
        tokenizer = eng_tts_tokenizer
        model = eng_tts_model
        model_name = ENG_TTS_MODEL_ID
    else:
        load_som_tts()
        tokenizer = som_tts_tokenizer
        model = som_tts_model
        model_name = SOM_TTS_MODEL_ID

    cleaned_text = text.strip()
    inputs = tokenizer(text=cleaned_text, return_tensors="pt")
    inputs = {key: val.to(device) for key, val in inputs.items()}

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp_path = Path(tmp.name)

    try:
        with torch.no_grad():
            outputs = model(**inputs)
        waveform = outputs.waveform[0].cpu().numpy()
        
        scipy.io.wavfile.write(
            str(tmp_path),
            rate=model.config.sampling_rate,
            data=waveform,
        )

        with open(tmp_path, "rb") as f:
            audio_data_b64 = base64.b64encode(f.read()).decode("utf-8")

        return {
            "audio_data": audio_data_b64,
            "content_type": "audio/wav",
            "sample_rate": model.config.sampling_rate,
            "device": device,
            "model": model_name,
        }
    except Exception as err:
        traceback.print_exc()
        return {"error": f"TTS failed: {str(err)}", "detail": traceback.format_exc()}
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


def dispatch(payload: Dict[str, Any]) -> Dict[str, Any]:
    action = (payload.get("action") or "health").strip().lower()
    if action == "transcribe":
        return handle_transcribe(payload)
    elif action == "synthesize":
        return handle_synthesize(payload)
    elif action == "health":
        return {
            "status": "ok",
            "device": device,
            "asr_model": ASR_MODEL_ID if asr_model is not None else "not_loaded",
            "somali_tts_model": SOM_TTS_MODEL_ID if som_tts_model is not None else "not_loaded",
            "english_tts_model": ENG_TTS_MODEL_ID if eng_tts_model is not None else "not_loaded",
        }
    else:
        return {"error": f"Unknown action: {action}"}
