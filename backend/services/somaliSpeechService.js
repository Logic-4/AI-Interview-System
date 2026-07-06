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

function isRunPodUrl(url) {
  return typeof url === 'string' && /api\.runpod\.ai\/v2\//i.test(url);
}

function getRunPodEndpointBase(url) {
  return url.replace(/\/+$/, '').replace(/\/(runsync|run|health|status)$/i, '');
}

function runPodHeaders() {
  const key = (process.env.RUNPOD_API_KEY || '').trim();
  if (!key) {
    throw new Error('RUNPOD_API_KEY is required for RunPod Somali speech services.');
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${key}`,
  };
}

async function transcribeAudio(fileBuffer, originalname = 'answer.webm', mimetype = 'audio/webm') {
  const asrUrl = getAsrBaseUrl();
  if (!asrUrl) {
    throw new Error('Somali ASR URL is not configured');
  }

  if (isRunPodUrl(asrUrl)) {
    const base = getRunPodEndpointBase(asrUrl);
    const runsyncUrl = `${base}/runsync`;
    
    logger.info(`[somaliSpeechService] POST transcribe via RunPod to ${runsyncUrl}`);
    const audio_data = fileBuffer.toString('base64');
    
    const response = await fetch(runsyncUrl, {
      method: 'POST',
      headers: runPodHeaders(),
      body: JSON.stringify({
        input: {
          action: 'transcribe',
          audio_data,
          filename: originalname,
        },
      }),
      signal: AbortSignal.timeout(ASR_TIMEOUT_MS),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Somali ASR RunPod error: status ${response.status} — ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.status === 'FAILED' || data.error) {
      throw new Error(`Somali ASR RunPod job failed: ${data.error || data.status}`);
    }
    const output = data.output || {};
    if (output.error) {
      throw new Error(`Somali ASR worker error: ${output.error}`);
    }
    const transcription = output.transcription || '';
    logger.info(`Somali ASR transcription received via RunPod (${transcription.length} chars)`);
    return transcription;
  }

  const form = new FormData();
  const blob = new Blob([fileBuffer], { type: mimetype || 'application/octet-stream' });
  form.append('file', blob, originalname || 'answer.webm');

  let response;
  try {
    response = await fetch(`${asrUrl}/transcribe`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(ASR_TIMEOUT_MS),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Somali ASR unreachable at ${asrUrl} (${msg}). `
      + 'Restart the backend and wait 1–3 min for ASR on port 8001. '
      + 'If first setup: cd backend && npm run setup:somali-speech'
    );
  }

  if (!response.ok) {
    const body = await response.text();
    const hint = body.includes('fetch failed') || body.includes('ECONNREFUSED')
      ? ' Somali ASR is not running — restart the backend and wait for port 8001, or run: cd backend && npm run setup:somali-speech'
      : '';
    throw new Error(`Somali ASR failed with ${response.status}: ${body.slice(0, 300)}${hint}`);
  }

  const data = await response.json();
  const transcription = data.transcription || data.text || '';
  logger.info(`Somali ASR transcription received (${transcription.length} chars)`);
  return transcription;
}

const SOMALI_TTS_CACHE = new Map();
const SOMALI_TTS_CACHE_MAX = 64;

function ttsCacheKey(text) {
  return text.trim();
}

async function synthesizeSomaliSpeech(text) {
  const key = ttsCacheKey(text);
  const cached = SOMALI_TTS_CACHE.get(key);
  if (cached) {
    logger.info(`Somali TTS cache hit (${text.length} chars)`);
    return cached;
  }

  const ttsUrl = getTtsBaseUrl();
  if (!ttsUrl) {
    throw new Error('Somali TTS URL is not configured');
  }

  if (isRunPodUrl(ttsUrl)) {
    const base = getRunPodEndpointBase(ttsUrl);
    const runsyncUrl = `${base}/runsync`;

    logger.info(`[somaliSpeechService] POST synthesize via RunPod to ${runsyncUrl}`);
    const response = await fetch(runsyncUrl, {
      method: 'POST',
      headers: runPodHeaders(),
      body: JSON.stringify({
        input: {
          action: 'synthesize',
          text,
        },
      }),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Somali TTS RunPod error: status ${response.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.status === 'FAILED' || data.error) {
      throw new Error(`Somali TTS RunPod job failed: ${data.error || data.status}`);
    }
    const output = data.output || {};
    if (output.error) {
      throw new Error(`Somali TTS worker error: ${output.error}`);
    }
    if (!output.audio_data) {
      throw new Error('Somali TTS RunPod did not return audio_data');
    }

    const audio = Buffer.from(output.audio_data, 'base64');
    const result = {
      audio,
      contentType: output.content_type || 'audio/wav',
    };

    if (SOMALI_TTS_CACHE.size >= SOMALI_TTS_CACHE_MAX) {
      const firstKey = SOMALI_TTS_CACHE.keys().next().value;
      SOMALI_TTS_CACHE.delete(firstKey);
    }
    SOMALI_TTS_CACHE.set(key, result);

    return result;
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
  const result = {
    audio,
    contentType: audioResponse.headers.get('content-type') || 'audio/wav',
  };

  if (SOMALI_TTS_CACHE.size >= SOMALI_TTS_CACHE_MAX) {
    const firstKey = SOMALI_TTS_CACHE.keys().next().value;
    SOMALI_TTS_CACHE.delete(firstKey);
  }
  SOMALI_TTS_CACHE.set(key, result);

  return result;
}

async function synthesizePiperSpeech(text, languageCode = 'en-US') {
  const piperUrl = trimBaseUrl(process.env.PIPER_BASE_URL || '');
  if (!piperUrl) {
    throw new Error(`No TTS service configured for ${languageCode}`);
  }

  if (isRunPodUrl(piperUrl)) {
    const base = getRunPodEndpointBase(piperUrl);
    const runsyncUrl = `${base}/runsync`;

    logger.info(`[somaliSpeechService] POST synthesize English via RunPod to ${runsyncUrl}`);
    const response = await fetch(runsyncUrl, {
      method: 'POST',
      headers: runPodHeaders(),
      body: JSON.stringify({
        input: {
          action: 'synthesize',
          text,
          language: 'english',
        },
      }),
      signal: AbortSignal.timeout(TTS_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`English TTS RunPod error: status ${response.status} — ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.status === 'FAILED' || data.error) {
      throw new Error(`English TTS RunPod job failed: ${data.error || data.status}`);
    }
    const output = data.output || {};
    if (output.error) {
      throw new Error(`English TTS worker error: ${output.error}`);
    }
    if (!output.audio_data) {
      throw new Error('English TTS RunPod did not return audio_data');
    }

    const audio = Buffer.from(output.audio_data, 'base64');
    return {
      audio,
      contentType: output.content_type || 'audio/wav',
    };
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
