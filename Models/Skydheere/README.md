# Somali ASR Setup

This workspace is prepared for the Hugging Face speech-to-text model:

`skydheere/wav2vec2-large-mms-1b-somalia`

## Files

- `requirements.txt`: Python dependencies
- `check_env.py`: confirms imports and CUDA availability
- `transcribe.py`: transcribes one audio file
- `transcribe_long.py`: chunks and transcribes long audio

## Expected audio format

- 16 kHz sample rate
- mono audio
- WAV is the safest format for first tests

Both transcription scripts automatically load audio as 16 kHz mono with `librosa`.

## Typical commands

```powershell
C:\Users\hp\AppData\Local\Programs\Python\Python311\python.exe check_env.py
C:\Users\hp\AppData\Local\Programs\Python\Python311\python.exe transcribe.py .\audio\sample.wav
C:\Users\hp\AppData\Local\Programs\Python\Python311\python.exe transcribe_long.py .\audio\long_call.wav --chunk-seconds 20
```

## Notes for this machine

- Python was installed at `C:\Users\hp\AppData\Local\Programs\Python\Python311\python.exe`
- The Windows Store `python` alias is still taking precedence in this shell, so use the full path above or open a fresh terminal after updating PATH yourself
- The Hugging Face model was downloaded and loaded successfully
- FFmpeg was installed at `C:\Users\hp\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.1-full_build\bin\ffmpeg.exe`
- `torchcodec` still fails to import on this machine, but it is not required for the provided transcription scripts
