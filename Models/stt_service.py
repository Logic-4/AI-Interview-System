"""
Somali ASR HTTP service (skydheere/wav2vec2-large-mms-1b-somalia).

Imports transcription logic from Skydheere/transcribe.py — run uvicorn from project root:

  cd /path/to/Models
  uvicorn stt_service:app --host 127.0.0.1 --port 8001

Ensure PYTHONPATH includes project root or run: uvicorn stt_service:app ...
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

# Allow `from transcribe import ...` when Skydheere is not on PYTHONPATH
_ROOT = Path(__file__).resolve().parent
if (_ROOT / "Skydheere" / "transcribe.py").is_file():
    sys.path.insert(0, str(_ROOT / "Skydheere"))

from fastapi import FastAPI, File, HTTPException, UploadFile

from transcribe import MODEL_ID, transcribe_file

app = FastAPI(title="Somali ASR Service", version="1.0.0")


@app.on_event("startup")
def preload_asr_model() -> None:
    """Warm the model cache at startup when possible (non-fatal if download is pending)."""
    import logging

    log = logging.getLogger("uvicorn.error")
    from transcribe import load_model

    model_id = os.environ.get("ASR_MODEL_ID", MODEL_ID)
    try:
        log.info(f"Loading Somali ASR model ({model_id})…")
        load_model(model_id)
        log.info("Somali ASR model ready")
    except Exception as exc:
        log.warning(
            "ASR model preload failed — service will stay up and retry on first /transcribe: %s",
            exc,
        )


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_ID}


@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(..., description="Audio file (WAV recommended; resampled to 16 kHz mono internally)."),
) -> dict:
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")

    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(data)
        tmp_path = Path(tmp.name)

    try:
        result = transcribe_file(tmp_path, os.environ.get("ASR_MODEL_ID", MODEL_ID))
        return {
            "transcription": result["text"],
            "model": result["model"],
            "device": result["device"],
        }
    except Exception as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Could not decode or transcribe audio ({suffix}): {exc}",
        ) from exc
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except OSError:
            pass


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8001)
