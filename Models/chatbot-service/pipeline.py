# End-to-end: STT (Somali) -> Aya chat -> TTS (Somali)
#
# Start services (three terminals):
#   Project root: uvicorn stt_service:app --host 127.0.0.1 --port 8001
#   chatbot-service: uvicorn app:app --host 127.0.0.1 --port 8000
#   tts-service: uvicorn main:app --host 127.0.0.1 --port 8002
#
# Then run this script from anywhere with correct URLs if needed.

from __future__ import annotations

import argparse
from pathlib import Path

import requests

DEFAULT_STT = "http://127.0.0.1:8001"
DEFAULT_CHAT = "http://127.0.0.1:8000"
DEFAULT_TTS = "http://127.0.0.1:8002"


def transcribe_audio(
    audio_file_path: str,
    stt_base: str = DEFAULT_STT,
) -> str:
    with open(audio_file_path, "rb") as f:
        files = {"file": (Path(audio_file_path).name, f, "application/octet-stream")}
        response = requests.post(f"{stt_base.rstrip('/')}/transcribe", files=files, timeout=600)
    response.raise_for_status()
    return response.json()["transcription"]


def generate_reply(
    user_text: str,
    chat_base: str = DEFAULT_CHAT,
    system_prompt: str = "You are a helpful multilingual assistant.",
) -> str:
    response = requests.post(
        f"{chat_base.rstrip('/')}/generate_reply",
        json={"user_text": user_text, "system_prompt": system_prompt},
        timeout=600,
    )
    response.raise_for_status()
    return response.json()["reply"]


def synthesize_speech(
    text: str,
    output_path: str,
    tts_base: str = DEFAULT_TTS,
    output_filename: str = "pipeline_reply.wav",
) -> None:
    r = requests.post(
        f"{tts_base.rstrip('/')}/synthesize",
        json={"text": text, "output_filename": output_filename},
        timeout=600,
    )
    r.raise_for_status()
    r2 = requests.get(f"{tts_base.rstrip('/')}/audio/{output_filename}", timeout=60)
    r2.raise_for_status()
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(output_path).write_bytes(r2.content)


def full_pipeline(
    audio_file_path: str,
    output_audio_path: str,
    *,
    stt_base: str = DEFAULT_STT,
    chat_base: str = DEFAULT_CHAT,
    tts_base: str = DEFAULT_TTS,
    system_prompt: str = "You are a helpful multilingual assistant.",
) -> None:
    user_text = transcribe_audio(audio_file_path, stt_base=stt_base)
    print(f"Transcribed: {user_text}")

    reply = generate_reply(user_text, chat_base=chat_base, system_prompt=system_prompt)
    print(f"Reply: {reply}")

    synthesize_speech(reply, output_audio_path, tts_base=tts_base)
    print(f"Audio saved to {output_audio_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="STT -> Chat -> TTS pipeline")
    parser.add_argument("input_audio", help="Path to input audio (e.g. WAV)")
    parser.add_argument("output_audio", help="Path to save reply WAV")
    parser.add_argument("--stt", default=DEFAULT_STT)
    parser.add_argument("--chat", default=DEFAULT_CHAT)
    parser.add_argument("--tts", default=DEFAULT_TTS)
    parser.add_argument("--system-prompt", default="You are a helpful multilingual assistant.")
    args = parser.parse_args()

    full_pipeline(
        args.input_audio,
        args.output_audio,
        stt_base=args.stt,
        chat_base=args.chat,
        tts_base=args.tts,
        system_prompt=args.system_prompt,
    )
