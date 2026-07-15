const crypto = require('crypto');
const logger = require('../utils/logger');

const ASR_TIMEOUT_MS = Number(process.env.SOMALI_ASR_TIMEOUT_MS || 90000);
const TTS_TIMEOUT_MS = Number(process.env.SOMALI_TTS_TIMEOUT_MS || 45000);
const TTS_FALLBACK_TIMEOUT_MS = Number(process.env.TTS_FALLBACK_TIMEOUT_MS || 12000);
const RUNPOD_POLL_MS = Number(process.env.RUNPOD_POLL_MS || 500);
const TTS_CACHE_MAX = Number(process.env.TTS_CACHE_MAX || 128);
const TTS_CACHE_TTL_MS = Number(process.env.TTS_CACHE_TTL_MS || 6 * 60 * 60 * 1000);
const TTS_CIRCUIT_OPEN_MS = Number(process.env.TTS_CIRCUIT_OPEN_MS || 60000);
const TTS_MODEL_VERSION = process.env.TTS_MODEL_VERSION || 'v1';

function trimBaseUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function getAsrBaseUrl() {
  return trimBaseUrl(process.env.SOMALI_ASR_URL || 'http://127.0.0.1:8001');
}

function getTtsBaseUrl() {
  return trimBaseUrl(process.env.SOMALI_TTS_URL || 'http://127.0.0.1:8002');
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

async function callSpeechRunPod(endpointUrl, payload, timeoutMs = TTS_TIMEOUT_MS) {
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
      error.code = 'TTS_TIMEOUT';
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

async function transcribeAudio(fileBuffer, originalname = 'answer.webm', mimetype = 'audio/webm') {
  const asrUrl = getAsrBaseUrl();
  if (!asrUrl) throw new Error('Somali ASR URL is not configured');

  if (isRunPodUrl(asrUrl)) {
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

const cache = new Map();
const inFlight = new Map();
const circuits = new Map();

function cacheKey(text, languageCode, provider, voice) {
  return crypto.createHash('sha256').update(JSON.stringify({
    text: normalizeText(text),
    languageCode: normalizeLanguage(languageCode),
    provider,
    voice: voice || '',
    modelVersion: TTS_MODEL_VERSION,
  })).digest('hex');
}

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  cache.delete(key);
  cache.set(key, entry);
  return { ...entry.value, cacheStatus: 'hit' };
}

function setCached(key, value) {
  while (cache.size >= TTS_CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + TTS_CACHE_TTL_MS });
}

function getCircuit(provider) {
  if (!circuits.has(provider)) circuits.set(provider, { failures: 0, openUntil: 0 });
  return circuits.get(provider);
}

function assertProviderAvailable(provider) {
  const state = getCircuit(provider);
  if (state.openUntil > Date.now()) {
    const error = new Error(`${provider} circuit is open`);
    error.code = 'TTS_CIRCUIT_OPEN';
    throw error;
  }
}

function recordProviderResult(provider, success, immediate = false) {
  const state = getCircuit(provider);
  if (success) {
    state.failures = 0;
    state.openUntil = 0;
    return;
  }
  state.failures += 1;
  if (immediate || state.failures >= 3) state.openUntil = Date.now() + TTS_CIRCUIT_OPEN_MS;
}

function validateAudio(audio, contentType) {
  if (!Buffer.isBuffer(audio) || audio.length <= 44) throw new Error('TTS returned empty or incomplete audio');
  const type = String(contentType || 'audio/wav').toLowerCase();
  if (!type.startsWith('audio/')) throw new Error(`TTS returned unsupported content type: ${type}`);
  if (type.includes('wav') && (audio.subarray(0, 4).toString('ascii') !== 'RIFF' || audio.subarray(8, 12).toString('ascii') !== 'WAVE')) {
    throw new Error('TTS returned a corrupt WAV container');
  }
}

async function synthesizeRunPod(url, text, languageCode, timeoutMs) {
  const output = await callSpeechRunPod(url, {
    action: 'synthesize',
    text,
    language: normalizeLanguage(languageCode) === 'so-SO' ? 'somali' : 'english',
    languageCode: normalizeLanguage(languageCode),
  }, timeoutMs);
  const audio = Buffer.from(output.audio_data || '', 'base64');
  const contentType = output.content_type || 'audio/wav';
  validateAudio(audio, contentType);
  return { audio, contentType, model: output.model || '' };
}

async function synthesizeSomaliHttp(url, text, timeoutMs) {
  const outputFilename = `tts_${Date.now()}_${crypto.randomBytes(6).toString('hex')}.wav`;
  const response = await fetch(`${url}/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, output_filename: outputFilename, language: 'so-SO' }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Somali TTS synth returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const data = await response.json().catch(() => ({}));
  const filename = data.output_filename || data.filename || outputFilename;
  const audioResponse = await fetch(`${url}/audio/${encodeURIComponent(filename)}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!audioResponse.ok) throw new Error(`Somali TTS audio returned ${audioResponse.status}`);
  const audio = Buffer.from(await audioResponse.arrayBuffer());
  const contentType = audioResponse.headers.get('content-type') || 'audio/wav';
  validateAudio(audio, contentType);
  return { audio, contentType, model: data.model || '' };
}

async function synthesizePiper(url, text, voice, timeoutMs) {
  const body = { text, length_scale: 1 };
  if (voice) body.voice = voice;
  const response = await fetch(`${url}/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Piper TTS returned ${response.status}: ${(await response.text()).slice(0, 200)}`);
  const audio = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || 'audio/wav';
  validateAudio(audio, contentType);
  return { audio, contentType, model: voice || 'piper-default' };
}

function providersFor(languageCode) {
  const isSomali = normalizeLanguage(languageCode) === 'so-SO';
  const providers = [];
  if (isSomali) {
    const primary = getTtsBaseUrl();
    if (primary) providers.push({ name: 'somali-primary', url: primary, kind: isRunPodUrl(primary) ? 'runpod' : 'somali-http', timeoutMs: TTS_TIMEOUT_MS });
    const fallback = trimBaseUrl(process.env.SOMALI_TTS_FALLBACK_URL || '');
    if (fallback && fallback !== primary) providers.push({ name: 'somali-fallback', url: fallback, kind: isRunPodUrl(fallback) ? 'runpod' : 'somali-http', timeoutMs: TTS_FALLBACK_TIMEOUT_MS });
    const piperUrl = trimBaseUrl(process.env.PIPER_BASE_URL || '');
    const voice = (process.env.PIPER_SO_VOICE || '').trim();
    if (piperUrl && voice) providers.push({ name: 'piper-somali', url: piperUrl, kind: 'piper', voice, timeoutMs: TTS_FALLBACK_TIMEOUT_MS });
  } else {
    const piperUrl = trimBaseUrl(process.env.PIPER_BASE_URL || '');
    if (piperUrl) providers.push({ name: 'piper-english', url: piperUrl, kind: isRunPodUrl(piperUrl) ? 'runpod' : 'piper', voice: (process.env.PIPER_EN_VOICE || process.env.PIPER_VOICE || '').trim(), timeoutMs: TTS_TIMEOUT_MS });
  }
  return providers;
}

async function synthesizeWithProvider(provider, text, languageCode) {
  if (provider.kind === 'runpod') return synthesizeRunPod(provider.url, text, languageCode, provider.timeoutMs);
  if (provider.kind === 'somali-http') return synthesizeSomaliHttp(provider.url, text, provider.timeoutMs);
  return synthesizePiper(provider.url, text, provider.voice, provider.timeoutMs);
}

async function synthesizeSpeech(text, languageCode = 'en-US', options = {}) {
  const normalizedText = normalizeText(text);
  const normalizedLanguage = normalizeLanguage(languageCode);
  if (!normalizedText) throw new Error('Text is required for TTS');
  if (normalizedText.length > 1000) throw new Error('Text exceeds the 1000 character TTS limit');

  const attempts = [];
  const providers = providersFor(normalizedLanguage);
  for (const provider of providers) {
    const cached = getCached(cacheKey(normalizedText, normalizedLanguage, provider.name, provider.voice));
    if (cached) return cached;
  }

  for (const provider of providers) {
    const key = cacheKey(normalizedText, normalizedLanguage, provider.name, provider.voice);
    if (inFlight.has(key)) return inFlight.get(key);

    const task = (async () => {
      const startedAt = Date.now();
      try {
        assertProviderAvailable(provider.name);
        const generated = await synthesizeWithProvider(provider, normalizedText, normalizedLanguage);
        const value = {
          ...generated,
          provider: provider.name,
          languageCode: normalizedLanguage,
          cacheStatus: 'miss',
          totalMs: Date.now() - startedAt,
        };
        recordProviderResult(provider.name, true);
        setCached(key, value);
        logger.info(JSON.stringify({ event: 'tts_complete', requestId: options.requestId, provider: provider.name, languageCode: normalizedLanguage, totalMs: value.totalMs, audioBytes: value.audio.length }));
        return value;
      } catch (error) {
        recordProviderResult(provider.name, false, [401, 403, 404].includes(error.statusCode));
        attempts.push({ provider: provider.name, message: error.message, totalMs: Date.now() - startedAt });
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();
    inFlight.set(key, task);
    try {
      return await task;
    } catch (error) {
      logger.warn(JSON.stringify({ event: 'tts_provider_failed', requestId: options.requestId, provider: provider.name, languageCode: normalizedLanguage, message: error.message }));
    }
  }

  const error = new Error(`No usable ${normalizedLanguage} speech provider is available`);
  error.code = 'TTS_UNAVAILABLE';
  error.attempts = attempts;
  throw error;
}

async function warmSpeechService(requestId = 'startup-warmup') {
  const asrUrl = getAsrBaseUrl();
  const ttsUrl = getTtsBaseUrl();
  const asrIsRunPod = isRunPodUrl(asrUrl);
  const ttsIsRunPod = isRunPodUrl(ttsUrl);

  if (!asrIsRunPod && !ttsIsRunPod) {
    return { status: 'skipped', reason: 'not_runpod' };
  }

  if (asrIsRunPod && ttsIsRunPod && getRunPodEndpointBase(asrUrl) === getRunPodEndpointBase(ttsUrl)) {
    return callSpeechRunPod(
      ttsUrl,
      { action: 'warmup', service: 'all', requestId },
      Math.max(ASR_TIMEOUT_MS, TTS_TIMEOUT_MS)
    );
  }

  const tasks = [];
  if (ttsIsRunPod) {
    tasks.push(callSpeechRunPod(
      ttsUrl,
      { action: 'warmup', service: 'somali_tts', requestId },
      TTS_TIMEOUT_MS
    ));
  }
  if (asrIsRunPod) {
    tasks.push(callSpeechRunPod(
      asrUrl,
      { action: 'warmup', service: 'asr', requestId },
      ASR_TIMEOUT_MS
    ));
  }

  const results = await Promise.all(tasks);
  return { status: 'ready', service: 'split', results };
}

module.exports = {
  transcribeAudio,
  synthesizeSpeech,
  warmSpeechService,
  getAsrBaseUrl,
  getTtsBaseUrl,
  normalizeLanguage,
  normalizeText,
  validateAudio,
  _cache: cache,
  _inFlight: inFlight,
  _circuits: circuits,
};
