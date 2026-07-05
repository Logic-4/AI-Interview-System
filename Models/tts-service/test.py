import argparse
from pathlib import Path

from service import SomaliTTS


def main() -> None:
    parser = argparse.ArgumentParser(description="Smoke test for Somali MMS-TTS.")
    parser.add_argument(
        "--text",
        default="Salaan, tani waa tijaabo cod dhalin ah.",
        help="Somali text to synthesize",
    )
    parser.add_argument(
        "--output",
        default=str(Path("outputs") / "test.wav"),
        help="Path to save the generated wav file",
    )
    args = parser.parse_args()

    tts = SomaliTTS()
    saved_path = tts.synthesize(args.text, args.output)
    print(f"Saved: {saved_path}")
    print(f"Device: {tts.device}")
    print(f"Sample rate: {tts.model.config.sampling_rate}")


if __name__ == "__main__":
    main()
