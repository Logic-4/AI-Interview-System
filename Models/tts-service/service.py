from __future__ import annotations

from pathlib import Path

import scipy.io.wavfile
import torch
from transformers import AutoTokenizer, VitsModel


class SomaliTTS:
    def __init__(self, model_name: str = "facebook/mms-tts-som") -> None:
        self.model_name = model_name
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.tokenizer = AutoTokenizer.from_pretrained(model_name)
        self.model = VitsModel.from_pretrained(model_name).to(self.device)
        self.model.eval()

    def synthesize(self, text: str, output_path: str = "outputs/output.wav") -> str:
        cleaned_text = text.strip()
        if not cleaned_text:
            raise ValueError("Text must not be empty.")

        destination = Path(output_path)
        destination.parent.mkdir(parents=True, exist_ok=True)

        inputs = self.tokenizer(text=cleaned_text, return_tensors="pt")
        inputs = {key: value.to(self.device) for key, value in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        waveform = outputs.waveform[0].cpu().numpy()
        scipy.io.wavfile.write(
            destination,
            rate=self.model.config.sampling_rate,
            data=waveform,
        )
        return str(destination)
