const logger = require('../utils/logger');

const ASR_TIMEOUT_MS = Number(process.env.SOMALI_ASR_TIMEOUT_MS || 180000);
const TTS_TIMEOUT_MS = Number(process.env.SOMALI_TTS_TIMEOUT_MS || 180000);

function trimBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function getAsrBaseUrl() {
  return trimBaseUrl(process.env.SOMALI_ASR_URL || 'http://127.0.0.1:8001');
}

function getTtsBaseUrl() {
  return trimBaseUrl(process.env.SOMALI_TTS_URL || 'http://127.0.0.1:8002');
}

async function transcribeAudio(fileBuffer, originalname = 'answer.webm', mimetype = 'audio/webm') {
  const asrUrl = getAsrBaseUrl();
  if (!asrUrl) {
    throw new Error('Somali ASR URL is not configured');
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimetype || 'application/octet-stream' });
  form.append('file', blob, originalname || 'answer.webm');

  const response = await fetch(`${asrUrl}/transcribe`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(ASR_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Somali ASR failed with ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  const transcription = data.transcription || data.text || '';
  logger.info(`Somali ASR transcription received (${transcription.length} chars)`);
  return transcription;
}

async function synthesizeSomaliSpeech(text) {
  const ttsUrl = getTtsBaseUrl();
  if (!ttsUrl) {
    throw new Error('Somali TTS URL is not configured');
  }

  const outputFilename = `tts_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`;
  const synthResponse = await fetch(`${ttsUrl}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, output_filename: outputFilename }),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });

  if (!synthResponse.ok) {
    const body = await synthResponse.text();
    throw new Error(`Somali TTS synth failed with ${synthResponse.status}: ${body.slice(0, 300)}`);
  }

  const audioResponse = await fetch(`${ttsUrl}/audio/${outputFilename}`, {
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });

  if (!audioResponse.ok) {
    const body = await audioResponse.text();
    throw new Error(`Somali TTS audio fetch failed with ${audioResponse.status}: ${body.slice(0, 300)}`);
  }

  const audio = Buffer.from(await audioResponse.arrayBuffer());
  return {
    audio,
    contentType: audioResponse.headers.get('content-type') || 'audio/wav',
  };
}

async function synthesizePiperSpeech(text, languageCode = 'en-US') {
  const piperUrl = trimBaseUrl(process.env.PIPER_BASE_URL || '');
  if (!piperUrl) {
    throw new Error(`No TTS service configured for ${languageCode}`);
  }

  const isSomali = languageCode.toLowerCase().startsWith('so');
  const voice = (isSomali ? process.env.PIPER_SO_VOICE : process.env.PIPER_EN_VOICE) || '';
  const body = { text, length_scale: 1 };
  if (voice.trim()) body.voice = voice.trim();

  const response = await fetch(`${piperUrl}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Piper TTS failed with ${response.status}: ${errorBody.slice(0, 300)}`);
  }

  return {
    audio: Buffer.from(await response.arrayBuffer()),
    contentType: response.headers.get('content-type') || 'audio/wav',
  };
}

async function synthesizeSpeech(text, languageCode = 'en-US') {
  if (!text || !text.trim()) {
    throw new Error('Text is required for TTS');
  }

  if (languageCode.toLowerCase().startsWith('so')) {
    return synthesizeSomaliSpeech(text.trim());
  }

  return synthesizePiperSpeech(text.trim(), languageCode);
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  getAsrBaseUrl,
  getTtsBaseUrl,
};
