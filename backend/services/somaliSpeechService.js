const logger = require('../utils/logger');
const geminiSpeechService = require('./geminiSpeechService');

const ASR_TIMEOUT_MS = Number(process.env.SOMALI_ASR_TIMEOUT_MS || 90000);
const RUNPOD_POLL_MS = Number(process.env.RUNPOD_POLL_MS || 500);

function trimBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function getAsrBaseUrl() {
  return trimBaseUrl(process.env.SOMALI_ASR_URL || 'http://127.0.0.1:8001');
}

function normalizeLanguage(language) {
  const value = String(language || 'en-US').trim().toLowerCase();
  return value === 'somali' || value === 'so' || value.startsWith('so-') ? 'so-SO' : 'en-US';
}

function normalizeText(text) {
  return String(text || '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function isRunPodUrl(url) {
  return typeof url === 'string' && /api\.runpod\.ai\/v2\//i.test(url);
}

function getRunPodEndpointBase(url) {
  return url.replace(/\/+$/, '').replace(/\/(runsync|run|health|status)$/i, '');
}

function runPodHeaders() {
  const key = (process.env.RUNPOD_API_KEY || '').trim();
  if (!key) throw new Error('RUNPOD_API_KEY is required for RunPod speech services.');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callSpeechRunPod(endpointUrl, payload, timeoutMs) {
  const base = getRunPodEndpointBase(endpointUrl);
  const startedAt = Date.now();
  const runResponse = await fetch(`${base}/run`, {
    method: 'POST',
    headers: runPodHeaders(),
    body: JSON.stringify({ input: payload }),
    signal: AbortSignal.timeout(Math.min(timeoutMs, 15000)),
  });
  if (!runResponse.ok) {
    const body = await runResponse.text();
    const error = new Error(`RunPod speech endpoint returned ${runResponse.status}: ${body.slice(0, 200)}`);
    error.statusCode = runResponse.status;
    throw error;
  }

  let data = await runResponse.json();
  const jobId = data.id;
  if (!jobId && data.status !== 'COMPLETED') throw new Error('RunPod speech endpoint did not return a job id');

  while (data.status !== 'COMPLETED') {
    if (['FAILED', 'CANCELLED', 'TIMED_OUT'].includes(data.status)) {
      throw new Error(`RunPod speech job ${data.status}: ${data.error || 'Unknown error'}`);
    }
    if (Date.now() - startedAt >= timeoutMs) {
      const error = new Error(`RunPod speech job timed out after ${timeoutMs}ms`);
      error.code = 'ASR_TIMEOUT';
      throw error;
    }
    await sleep(RUNPOD_POLL_MS);
    const statusResponse = await fetch(`${base}/status/${jobId}`, {
      headers: runPodHeaders(),
      signal: AbortSignal.timeout(10000),
    });
    if (!statusResponse.ok) throw new Error(`RunPod speech status returned ${statusResponse.status}`);
    data = await statusResponse.json();
  }

  const output = data.output || {};
  if (output.error) throw new Error(`RunPod speech worker error: ${output.error}`);
  return output;
}

/**
 * Transcribes a recorded answer. English routes to Gemini's audio
 * understanding (services/geminiSpeechService.js); Somali stays on the
 * dedicated RunPod/local wav2vec2 ASR worker.
 */
async function transcribeAudio(fileBuffer, originalname = 'answer.webm', mimetype = 'audio/webm', languageCode = 'so-SO') {
  const normalizedLanguage = normalizeLanguage(languageCode);
  const provider = normalizedLanguage === 'en-US' ? 'gemini' : 'somali-asr';
  logger.info(`[STT] language=${languageCode} -> normalized=${normalizedLanguage} provider=${provider}`);

  if (normalizedLanguage === 'en-US') {
    return normalizeText(await geminiSpeechService.transcribeAudioEnglish(fileBuffer, mimetype, originalname));
  }

  const asrUrl = getAsrBaseUrl();
  if (!asrUrl) throw new Error('Somali ASR URL is not configured');

  if (isRunPodUrl(asrUrl)) {
    if (!(process.env.RUNPOD_API_KEY || '').trim()) {
      throw new Error('SOMALI_ASR_URL points to RunPod but RUNPOD_API_KEY is not set — check .env');
    }
    const output = await callSpeechRunPod(asrUrl, {
      action: 'transcribe',
      audio_data: fileBuffer.toString('base64'),
      filename: originalname,
    }, ASR_TIMEOUT_MS);
    const transcription = normalizeText(output.transcription || '');
    logger.info(`Somali ASR transcription received via RunPod (${transcription.length} chars)`);
    return transcription;
  }

  const form = new FormData();
  form.append('file', new Blob([fileBuffer], { type: mimetype || 'application/octet-stream' }), originalname);
  let response;
  try {
    response = await fetch(`${asrUrl}/transcribe`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(ASR_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(`Somali ASR is unreachable (${error.message})`);
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Somali ASR failed with ${response.status}: ${body.slice(0, 300)}`);
  }
  const data = await response.json();
  return normalizeText(data.transcription || data.text || '');
}

/**
 * Warms the Somali ASR endpoint. English STT runs on Gemini, which has no
 * meaningful cold-start to warm, so English warmup requests are a no-op.
 */
async function warmSpeechService(requestId = 'startup-warmup', language = 'all') {
  const normalizedWarmupLanguage = String(language || 'all').toLowerCase();
  if (normalizedWarmupLanguage === 'english') {
    return { status: 'skipped', reason: 'gemini_no_warmup_needed' };
  }

  const asrUrl = getAsrBaseUrl();
  if (!asrUrl) {
    return { status: 'skipped', reason: 'no_endpoints' };
  }

  if (isRunPodUrl(asrUrl)) {
    return callSpeechRunPod(asrUrl, { action: 'warmup', service: 'asr', requestId }, ASR_TIMEOUT_MS)
      .catch((err) => ({ service: 'asr', error: err.message }));
  }

  return fetch(`${asrUrl}/health`, { signal: AbortSignal.timeout(5000) })
    .then((res) => ({ service: 'asr', status: res.status }))
    .catch((err) => ({ service: 'asr', error: err.message }));
}

module.exports = {
  transcribeAudio,
  warmSpeechService,
  getAsrBaseUrl,
  normalizeLanguage,
  normalizeText,
};
