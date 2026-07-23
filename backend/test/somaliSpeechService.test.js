const test = require('node:test');
const assert = require('node:assert/strict');

process.env.ENGLISH_TTS_URL = 'https://api.runpod.ai/v2/english-speech';
process.env.KOKORO_VOICE = 'af_heart';
process.env.RUNPOD_API_KEY = 'test-key';
process.env.SOMALI_TTS_URL = 'http://somali-primary.test';
process.env.SOMALI_TTS_FALLBACK_URL = 'http://somali-fallback.test';

const speech = require('../services/somaliSpeechService');

function validWav() {
  const audio = Buffer.alloc(64);
  audio.write('RIFF', 0, 'ascii');
  audio.write('WAVE', 8, 'ascii');
  return audio;
}

function resetState() {
  speech._cache.clear();
  speech._inFlight.clear();
  speech._circuits.clear();
}

test('normalizes Somali locale aliases and Unicode text', () => {
  assert.equal(speech.normalizeLanguage('so'), 'so-SO');
  assert.equal(speech.normalizeLanguage('so-SO'), 'so-SO');
  assert.equal(speech.normalizeLanguage('somali'), 'so-SO');
  assert.equal(speech.normalizeLanguage('en-GB'), 'en-US');
  assert.equal(speech.normalizeText('  Su\u2019aal\n\n cusub  '), 'Su\u2019aal cusub');
});

test('deduplicates concurrent Kokoro synthesis and serves the warm cache', async () => {
  resetState();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async (url) => {
    calls += 1;
    await new Promise((resolve) => setTimeout(resolve, 15));
    if (String(url).endsWith('/run')) {
      return Response.json({
        status: 'COMPLETED',
        output: { audio_data: validWav().toString('base64'), content_type: 'audio/wav', model: 'hexgrad/Kokoro-82M' },
      });
    }
    return new Response(validWav(), { status: 200, headers: { 'content-type': 'audio/wav' } });
  };
  try {
    const [first, second] = await Promise.all([
      speech.synthesizeSpeech('Explain React hooks?', 'en-US'),
      speech.synthesizeSpeech('Explain   React hooks?', 'en-US'),
    ]);
    assert.equal(calls, 1);
    assert.equal(first.provider, 'kokoro-english');
    assert.equal(second.provider, 'kokoro-english');
    const cached = await speech.synthesizeSpeech('Explain React hooks?', 'en-US');
    assert.equal(calls, 1);
    assert.equal(cached.cacheStatus, 'hit');
  } finally {
    global.fetch = originalFetch;
  }
});

test('falls back to the secondary Somali provider when the primary fails', async () => {
  resetState();
  const originalFetch = global.fetch;
  const urls = [];
  global.fetch = async (url) => {
    const value = String(url);
    urls.push(value);
    if (value.startsWith('http://somali-primary.test')) {
      return new Response('primary unavailable', { status: 503 });
    }
    if (value.endsWith('/synthesize')) {
      return Response.json({ output_filename: 'fallback.wav', model: 'fallback-model' });
    }
    return new Response(validWav(), { status: 200, headers: { 'content-type': 'audio/wav' } });
  };
  try {
    const result = await speech.synthesizeSpeech('Sidee ayaad u xallisaa dhibaatada?', 'so');
    assert.equal(result.provider, 'somali-fallback');
    assert.ok(urls.some((url) => url.startsWith('http://somali-primary.test')));
    assert.ok(urls.some((url) => url.startsWith('http://somali-fallback.test')));
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects corrupt audio instead of sending it to the browser', () => {
  assert.throws(() => speech.validateAudio(Buffer.from('not audio'), 'audio/wav'), /empty|incomplete|corrupt/i);
});

test('warms ASR and Somali TTS with one all-service job on a unified RunPod endpoint', async () => {
  const originalFetch = global.fetch;
  const originalAsrUrl = process.env.SOMALI_ASR_URL;
  const originalTtsUrl = process.env.SOMALI_TTS_URL;
  const originalRunPodKey = process.env.RUNPOD_API_KEY;
  const originalEnglishAsrUrl = process.env.ENGLISH_ASR_URL;
  const originalEnglishTtsUrl = process.env.ENGLISH_TTS_URL;
  const requests = [];

  process.env.SOMALI_ASR_URL = 'https://api.runpod.ai/v2/unified-speech';
  process.env.SOMALI_TTS_URL = 'https://api.runpod.ai/v2/unified-speech/run';
  process.env.RUNPOD_API_KEY = 'test-key';
  delete process.env.ENGLISH_ASR_URL;
  delete process.env.ENGLISH_TTS_URL;
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({
      status: 'COMPLETED',
      output: { status: 'ready', service: 'all', models: { asr: 'loaded', somali_tts: 'loaded' } },
    });
  };

  try {
    const result = await speech.warmSpeechService('test-warmup');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.runpod.ai/v2/unified-speech/run');
    assert.deepEqual(requests[0].body.input, {
      action: 'warmup',
      service: 'all',
      requestId: 'test-warmup',
    });
    assert.equal(result.models.asr, 'loaded');
    assert.equal(result.models.somali_tts, 'loaded');
  } finally {
    global.fetch = originalFetch;
    if (originalAsrUrl === undefined) delete process.env.SOMALI_ASR_URL;
    else process.env.SOMALI_ASR_URL = originalAsrUrl;
    if (originalTtsUrl === undefined) delete process.env.SOMALI_TTS_URL;
    else process.env.SOMALI_TTS_URL = originalTtsUrl;
    if (originalRunPodKey === undefined) delete process.env.RUNPOD_API_KEY;
    else process.env.RUNPOD_API_KEY = originalRunPodKey;
    if (originalEnglishAsrUrl === undefined) delete process.env.ENGLISH_ASR_URL;
    else process.env.ENGLISH_ASR_URL = originalEnglishAsrUrl;
    if (originalEnglishTtsUrl === undefined) delete process.env.ENGLISH_TTS_URL;
    else process.env.ENGLISH_TTS_URL = originalEnglishTtsUrl;
  }
});

test('sends English recordings to the Whisper worker with a transcribe action', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.ENGLISH_ASR_URL;
  process.env.ENGLISH_ASR_URL = 'https://api.runpod.ai/v2/english-speech';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ status: 'COMPLETED', output: { transcription: 'Hello from Whisper', model: 'large-v3-turbo' } });
  };
  try {
    const transcript = await speech.transcribeAudio(Buffer.from('audio'), 'answer.webm', 'audio/webm', 'en-US');
    assert.equal(transcript, 'Hello from Whisper');
    assert.equal(requests[0].url, 'https://api.runpod.ai/v2/english-speech/run');
    assert.equal(requests[0].body.input.action, 'transcribe');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.ENGLISH_ASR_URL;
    else process.env.ENGLISH_ASR_URL = originalUrl;
  }
});
