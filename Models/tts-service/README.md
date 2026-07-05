# Somali TTS Service

This folder provides a simple Somali text-to-speech service using the Hugging Face MMS TTS model:

`facebook/mms-tts-som`

## Files

- `service.py`: reusable `SomaliTTS` class
- `app.py`: simple one-file runner that creates a sample WAV file
- `test.py`: smoke test with custom text and output path
- `main.py`: FastAPI service for API-based integration
- `requirements.txt`: TTS-specific Python dependencies
- `outputs/`: generated audio files

## Recommended setup

Create a dedicated environment inside this folder:

```powershell
cd C:\Users\hp\OneDrive\Documents\Skydheere\tts-service
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If the Windows Store `python` alias causes trouble on this machine, use the installed Python directly:

```powershell
C:\Users\hp\AppData\Local\Programs\Python\Python311\python.exe -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Run the sample script

```powershell
python app.py
```

Expected output file:

`outputs\somali.wav`

## Run the smoke test

```powershell
python test.py --text "Salaan, ku soo dhawoow adeegga codka." --output outputs\demo.wav
```

## Run the API

```powershell
uvicorn main:app --reload
```

Then open:

- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8000/docs`

## Example API request

```powershell
Invoke-RestMethod `
  -Uri http://127.0.0.1:8000/synthesize `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"text":"Salaan, tani waa cod tijaabo ah.","output_filename":"from_api.wav"}'
```

The endpoint saves WAV files into `outputs/`.
