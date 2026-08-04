const { GoogleGenAI, Modality, createUserContent, createPartFromBase64 } = require('@google/genai');
const logger = require('../utils/logger');
const { transcodeToWav } = require('./audioTranscodeService');

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
const STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-2.5-flash';
// Pinned to a specific prebuilt voice — do not let this fall back silently.
// Env override is allowed for ops, but the product default is "Orus".
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || 'Orus';
const MAX_TEXT_LENGTH = 1000;
// Gemini TTS docs state the model "occasionally returns text tokens instead of
// audio tokens, causing the server to fail the request with a 500 error" and
// recommend automated retry logic. We retry the FULL synthesis (connect + read
// stream) since the failure can surface either as a thrown error at connect or
// as a stream that completes with zero audio chunks. Chunks from a failed
// attempt are buffered internally so nothing is yielded downstream until an
// attempt succeeds, keeping retries safe.
const MAX_SYNTHESIS_ATTEMPTS = 3;
const SYNTHESIS_BACKOFF_MS = 400;
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
  const streamConfig = {
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
  };

  let lastError;
  for (let attempt = 1; attempt <= MAX_SYNTHESIS_ATTEMPTS; attempt++) {
    const buffered = [];
    try {
      const stream = await ai.models.generateContentStream(streamConfig);
      for await (const response of stream) {
        const data = response.data;
        if (!data) continue;
        buffered.push(Buffer.from(data, 'base64'));
      }
      if (buffered.length > 0) {
        for (const chunk of buffered) yield chunk;
        logger.info(
          `[geminiSpeechService] Synthesized ${buffered.length} chunk(s) on attempt ${attempt} [voice=${VOICE_NAME}, lang=${languageCode}]`,
        );
        return;
      }
      // Documented failure mode: model returned text tokens instead of audio.
      lastError = new Error('Gemini TTS returned no audio data (model emitted text tokens)');
    } catch (err) {
      lastError = err;
    }
    if (attempt < MAX_SYNTHESIS_ATTEMPTS) {
      logger.warn(
        `[geminiSpeechService] TTS attempt ${attempt}/${MAX_SYNTHESIS_ATTEMPTS} failed — retrying: ${lastError.message}`,
      );
      await new Promise((r) => setTimeout(r, SYNTHESIS_BACKOFF_MS * attempt));
    }
  }
  throw lastError || new Error('Gemini TTS failed after all attempts');
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
