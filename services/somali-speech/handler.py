import runpod
from worker import dispatch, load_asr, load_som_tts, load_eng_tts


def handler(job):
    payload = job.get("input") or {}
    try:
        return dispatch(payload)
    except Exception as exc:
        import traceback

        traceback.print_exc()
        return {"error": str(exc), "detail": traceback.format_exc()}


if __name__ == "__main__":
    # Pre-download and load models into GPU memory at container startup
    try:
        print("Preloading ASR model...")
        load_asr()
        print("Preloading Somali TTS model...")
        load_som_tts()
        print("Preloading English TTS model...")
        load_eng_tts()
        print("All models successfully loaded at startup.")
    except Exception as exc:
        print(f"Warning: Model preloading failed: {exc}. Models will load on first request.")

    runpod.serverless.start({"handler": handler})
