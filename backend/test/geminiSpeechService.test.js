const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GEMINI_API_KEY = 'test-key';

// The SDK client is constructed lazily inside geminiSpeechService and cached
// in a module-level singleton (getClient() never reconstructs it once set),
// so the fake class itself must stay the SAME instance across tests — only
// swap the handler it delegates to, not the class on @google/genai's export.
let currentHandler = async function* () {};
class FakeGoogleGenAI {
  constructor() {
    this.models = {
      generateContentStream: async () => currentHandler(),
    };
  }
}
require('@google/genai').GoogleGenAI = FakeGoogleGenAI;

const { synthesizeSpeechStream } = require('../services/geminiSpeechService');

async function collect(gen) {
  const out = [];
  for await (const chunk of gen) out.push(chunk);
  return out;
}

const audioChunk = (byte) => ({ data: Buffer.from([byte]).toString('base64') });

test('streams audio chunks as they arrive instead of buffering the whole clip', async () => {
  currentHandler = async function* () {
    yield audioChunk(1);
    yield audioChunk(2);
  };
  const chunks = await collect(synthesizeSpeechStream('Hello', 'en-US'));
  assert.deepEqual(chunks.map((c) => c[0]), [1, 2]);
});

test('retries on the documented zero-chunk failure mode', async () => {
  let call = 0;
  currentHandler = async function* () {
    call += 1;
    if (call === 1) return; // zero chunks — the documented failure mode
    yield audioChunk(9);
  };
  const chunks = await collect(synthesizeSpeechStream('Hello', 'en-US'));
  assert.equal(call, 2);
  assert.deepEqual(chunks.map((c) => c[0]), [9]);
});

test('does not retry after already streaming real audio, even if the stream later errors', async () => {
  let call = 0;
  currentHandler = async function* () {
    call += 1;
    yield audioChunk(5);
    throw new Error('stream dropped mid-clip');
  };
  await assert.rejects(collect(synthesizeSpeechStream('Hello', 'en-US')), /stream dropped mid-clip/);
  assert.equal(call, 1, 'must not retry once real audio has already been yielded to the caller');
});
