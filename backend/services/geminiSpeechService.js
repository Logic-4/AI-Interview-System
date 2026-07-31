const { GoogleGenAI, Modality, createUserContent, createPartFromBase64 } = require('@google/genai');
const logger = require('../utils/logger');
const { transcodeToWav } = require('./audioTranscodeService');

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
const STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash';
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || 'Kore';
const MAX_TEXT_LENGTH = 1000;
const TRANSCRIBE_PROMPT = 'Transcribe this English audio recording exactly as spoken. '
  + 'Return only the transcription text, with no commentary, labels, or additional formatting. '
  + 'If nothing intelligible was said, return an empty string.';

let client = null;

function getClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  client = new GoogleGenAI({ apiKey });
  return client;
}

/**
 * Streams synthesized speech for `text` as an async generator of raw PCM
 * chunks (24kHz, 16-bit, mono — per Gemini TTS's documented output format).
 * Works for both English and Somali via the same model/code path.
 */
async function* synthesizeSpeechStream(text, languageCode = 'en-US') {
  const cleaned = String(text || '').trim();
  if (!cleaned) {
    throw new Error('Missing text for speech synthesis');
  }
  if (cleaned.length > MAX_TEXT_LENGTH) {
    throw new Error(`Text exceeds the ${MAX_TEXT_LENGTH} character synthesis limit`);
  }

  const ai = getClient();
  const stream = await ai.models.generateContentStream({
    model: TTS_MODEL,
    contents: cleaned,
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: VOICE_NAME },
        },
      },
    },
  });

  let chunkCount = 0;
  for await (const response of stream) {
    const data = response.data;
    if (!data) continue;
    chunkCount += 1;
    yield Buffer.from(data, 'base64');
  }

  if (chunkCount === 0) {
    throw new Error('Gemini TTS returned no audio data');
  }

  logger.info(`[geminiSpeechService] Synthesized ${chunkCount} chunk(s) for language ${languageCode}`);
}

/**
 * Transcribes an English audio recording using Gemini's audio understanding.
 * The recording is transcoded to WAV first since WebM/Opus (what the browser
 * records) isn't in Gemini's officially supported input format list.
 */
async function transcribeAudioEnglish(fileBuffer, mimetype = 'audio/webm', originalname = 'answer.webm') {
  const suffix = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '.webm';
  const wavBuffer = await transcodeToWav(fileBuffer, suffix);

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: STT_MODEL,
    contents: createUserContent([
      createPartFromBase64(wavBuffer.toString('base64'), 'audio/wav'),
      TRANSCRIBE_PROMPT,
    ]),
  });

  const transcription = String(response.text || '').trim();
  logger.info(`[geminiSpeechService] English transcription received via Gemini (${transcription.length} chars)`);
  return transcription;
}

module.exports = {
  synthesizeSpeechStream,
  transcribeAudioEnglish,
  TTS_MODEL,
  STT_MODEL,
};
