FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY Models/Skydheere/requirements.txt /tmp/asr-requirements.txt
RUN pip install --no-cache-dir -r /tmp/asr-requirements.txt \
    fastapi uvicorn[standard] python-multipart

COPY Models/stt_service.py /app/stt_service.py
COPY Models/Skydheere/transcribe.py /app/Skydheere/transcribe.py

ENV PYTHONPATH=/app/Skydheere
ENV ASR_MODEL_ID=skydheere/wav2vec2-large-mms-1b-somalia

EXPOSE 8001

CMD ["uvicorn", "stt_service:app", "--host", "0.0.0.0", "--port", "8001"]
