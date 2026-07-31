const test = require('node:test');
const assert = require('node:assert/strict');

const speech = require('../services/somaliSpeechService');
const geminiSpeechService = require('../services/geminiSpeechService');

test('normalizes Somali locale aliases and Unicode text', () => {
  assert.equal(speech.normalizeLanguage('so'), 'so-SO');
  assert.equal(speech.normalizeLanguage('so-SO'), 'so-SO');
  assert.equal(speech.normalizeLanguage('somali'), 'so-SO');
  assert.equal(speech.normalizeLanguage('en-GB'), 'en-US');
  assert.equal(speech.normalizeText('  Su’aal\n\n cusub  '), 'Su’aal cusub');
});

test('routes English transcription to Gemini audio understanding', async () => {
  const original = geminiSpeechService.transcribeAudioEnglish;
  let called = null;
  geminiSpeechService.transcribeAudioEnglish = async (buffer, mimetype, originalname) => {
    called = { mimetype, originalname };
    return 'Hello from Gemini';
  };
  try {
    const transcript = await speech.transcribeAudio(Buffer.from('audio'), 'answer.webm', 'audio/webm', 'en-US');
    assert.equal(transcript, 'Hello from Gemini');
    assert.equal(called.mimetype, 'audio/webm');
    assert.equal(called.originalname, 'answer.webm');
  } finally {
    geminiSpeechService.transcribeAudioEnglish = original;
  }
});

test('sends Somali recordings to the Somali ASR worker with a transcribe action', async () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.SOMALI_ASR_URL;
  const originalKey = process.env.RUNPOD_API_KEY;
  process.env.SOMALI_ASR_URL = 'https://api.runpod.ai/v2/somali-speech';
  process.env.RUNPOD_API_KEY = 'test-key';
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ status: 'COMPLETED', output: { transcription: 'Salaan', model: 'wav2vec2-large-mms-1b-somalia' } });
  };
  try {
    const transcript = await speech.transcribeAudio(Buffer.from('audio'), 'answer.webm', 'audio/webm', 'so-SO');
    assert.equal(transcript, 'Salaan');
    assert.equal(requests[0].url, 'https://api.runpod.ai/v2/somali-speech/run');
    assert.equal(requests[0].body.input.action, 'transcribe');
  } finally {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.SOMALI_ASR_URL;
    else process.env.SOMALI_ASR_URL = originalUrl;
    if (originalKey === undefined) delete process.env.RUNPOD_API_KEY;
    else process.env.RUNPOD_API_KEY = originalKey;
  }
});

test('warmup is a no-op for English (Gemini has no cold start) and warms RunPod for Somali', async () => {
  const originalFetch = global.fetch;
  const previous = {
    SOMALI_ASR_URL: process.env.SOMALI_ASR_URL,
    RUNPOD_API_KEY: process.env.RUNPOD_API_KEY,
  };
  const requests = [];
  process.env.SOMALI_ASR_URL = 'https://api.runpod.ai/v2/somali-speech';
  process.env.RUNPOD_API_KEY = 'test-key';
  global.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json({ status: 'COMPLETED', output: { status: 'ready' } });
  };

  try {
    const englishResult = await speech.warmSpeechService('english-only', 'english');
    assert.equal(englishResult.status, 'skipped');
    assert.equal(requests.length, 0);

    const somaliResult = await speech.warmSpeechService('somali-only', 'somali');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].url, 'https://api.runpod.ai/v2/somali-speech/run');
    assert.equal(requests[0].body.input.service, 'asr');
    assert.equal(somaliResult.status, 'ready');
  } finally {
    global.fetch = originalFetch;
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
