import re
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from service import SomaliTTS


app = FastAPI(title="Somali TTS Service", version="1.0.0")
tts = SomaliTTS()


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Somali text to synthesize")
    output_filename: str = Field(
        default="api_output.wav",
        pattern=r"^[A-Za-z0-9._-]+\.wav$",
        description="Name of the wav file to create inside outputs/",
    )


class TTSResponse(BaseModel):
    output_path: str
    sample_rate: int
    device: str


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model": tts.model_name, "device": tts.device}


@app.get("/audio/{filename}")
def download_wav(filename: str) -> FileResponse:
    """Serve a WAV from outputs/ (for clients that cannot read the server's local path)."""
    if not re.fullmatch(r"[A-Za-z0-9._-]+\.wav", filename):
        raise HTTPException(status_code=400, detail="Invalid filename")
    path = Path("outputs") / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="audio/wav", filename=filename)


@app.post("/synthesize", response_model=TTSResponse)
def synthesize(request: TTSRequest) -> TTSResponse:
    try:
        output_path = Path("outputs") / request.output_filename
        saved_path = tts.synthesize(request.text, str(output_path))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return TTSResponse(
        output_path=saved_path,
        sample_rate=tts.model.config.sampling_rate,
        device=tts.device,
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8002)
