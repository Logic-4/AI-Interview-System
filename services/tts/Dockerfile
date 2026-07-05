FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY Models/tts-service/requirements.txt /tmp/tts-requirements.txt
RUN pip install --no-cache-dir -r /tmp/tts-requirements.txt

COPY Models/tts-service/service.py /app/service.py
COPY Models/tts-service/main.py /app/main.py
RUN mkdir -p /app/outputs

EXPOSE 8002

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8002"]
