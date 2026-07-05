from pathlib import Path

from service import SomaliTTS


DEFAULT_TEXT = "Salaan, ku soo dhawoow nidaamka codka Soomaaliga."


if __name__ == "__main__":
    output_path = Path("outputs") / "somali.wav"
    tts = SomaliTTS()
    saved_path = tts.synthesize(DEFAULT_TEXT, str(output_path))
    print(f"Using device: {tts.device}")
    print(f"Model: {tts.model_name}")
    print(f"Saved audio to: {saved_path}")
    print(f"Sample rate: {tts.model.config.sampling_rate}")
