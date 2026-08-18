const { GoogleGenAI, Modality, createUserContent, createPartFromBase64 } = require('@google/genai');
const logger = require('../utils/logger');
const { transcodeToWav } = require('./audioTranscodeService');

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
// STT for both English and Somali — Gemini Flash Latest, thinking level medium.
const STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-flash-latest';
const STT_THINKING_LEVEL = process.env.GEMINI_STT_THINKING_LEVEL || 'medium';
// Gemini's audio-understanding endpoint returns transient 503 "high demand" /
// 429 errors under normal load — measured live, not hypothetical. The SDK's
// own retry is opt-in (disabled unless retryOptions is passed), so without
// this every transient error failed the candidate's turn outright.
const STT_TIMEOUT_MS = Number(process.env.GEMINI_STT_TIMEOUT_MS || 20000);
const STT_RETRY_ATTEMPTS = Number(process.env.GEMINI_STT_RETRY_ATTEMPTS || 3);
// Pinned to a specific prebuilt voice — do not let this fall back silently.
// Env override is allowed for ops, but the product default is "Orus".
const VOICE_NAME = process.env.GEMINI_TTS_VOICE || 'Orus';
logger.info(`[geminiSpeechService] TTS voice="${VOICE_NAME}" model="${TTS_MODEL}" (source: ${process.env.GEMINI_TTS_VOICE ? 'env' : 'default'})`);
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

function isSomaliLanguage(languageCode) {
  return /^so/i.test(String(languageCode || ''));
}

function buildTranscribePrompt(languageCode) {
  return isSomaliLanguage(languageCode)
    ? 'Transcribe this Somali audio recording exactly as spoken, including any embedded English '
      + 'technical terms exactly as pronounced. Return only the transcription text, with no '
      + 'commentary, labels, or additional formatting. If nothing intelligible was said, return an empty string.'
    : 'Transcribe this English audio recording exactly as spoken. '
      + 'Return only the transcription text, with no commentary, labels, or additional formatting. '
      + 'If nothing intelligible was said, return an empty string.';
}

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

  // Gemini TTS is "controllable" — the model reads a natural-language style
  // directive prefixed to the text and applies it to the whole utterance. Without
  // one, it auto-detects language per-token and pronounces embedded English
  // words (e.g. "React", "API", "senior developer") in English even when the
  // sentence is Somali. Force the target language so every token is pronounced
  // in the same voice/language.
  const isSomali = /^so/i.test(String(languageCode));
  const styledPrompt = isSomali
    ? `Ku hadal Af-Soomaali kaliya, si dabiici ah oo xirfad leh, oo ku dhawaaq dhammaan ereyada — xataa erayada Ingiriisiga ah — sida Af-Soomaali:\n\n${cleaned}`
    : `Read the following in natural, professional English:\n\n${cleaned}`;

  const ai = getClient();
  const streamConfig = {
    model: TTS_MODEL,
    contents: styledPrompt,
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
  const requestStartedAt = Date.now();
  for (let attempt = 1; attempt <= MAX_SYNTHESIS_ATTEMPTS; attempt++) {
    let chunkCount = 0;
    try {
      const stream = await ai.models.generateContentStream(streamConfig);
      // Yield each chunk live instead of buffering the whole clip first — the
      // documented failure mode is all-or-nothing (a thrown error at connect,
      // or a stream that completes with zero audio chunks), never "starts
      // with real audio then fails partway", so nothing is lost by trusting
      // the first chunk. Buffering here previously forced callers (the HTTP
      // response, then frontend playback) to wait for the ENTIRE clip to
      // finish generating before hearing anything, which is most of the
      // "text appears, voice lags" latency this exists to fix.
      for await (const response of stream) {
        const data = response.data;
        if (!data) continue;
        if (chunkCount === 0) {
          logger.info(`[geminiSpeechService] TTS first chunk in ${Date.now() - requestStartedAt}ms [attempt ${attempt}, lang=${languageCode}]`);
        }
        chunkCount += 1;
        yield Buffer.from(data, 'base64');
      }
      if (chunkCount > 0) {
        logger.info(
          `[geminiSpeechService] Synthesized ${chunkCount} chunk(s) on attempt ${attempt} [voice=${VOICE_NAME}, lang=${languageCode}]`,
        );
        return;
      }
      // Documented failure mode: model returned text tokens instead of audio.
      lastError = new Error('Gemini TTS returned no audio data (model emitted text tokens)');
    } catch (err) {
      lastError = err;
      if (chunkCount > 0) {
        // Already streamed real audio to the caller this attempt — a retry
        // would restart playback from the top, which is worse than just
        // ending. Give up here instead of masking it as a clean success.
        throw lastError;
      }
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
 * Transcribes a recorded answer using Gemini's audio understanding — same
 * model and code path for both English and Somali. The recording is
 * transcoded to WAV first since WebM/Opus (what the browser records) isn't
 * in Gemini's officially supported input format list.
 */
async function transcribeAudio(fileBuffer, originalname = 'answer.webm', mimetype = 'audio/webm', languageCode = 'en-US') {
  const suffix = originalname.includes('.') ? originalname.slice(originalname.lastIndexOf('.')) : '.webm';
  const wavBuffer = await transcodeToWav(fileBuffer, suffix);

  const ai = getClient();
  const response = await ai.models.generateContent({
    model: STT_MODEL,
    contents: createUserContent([
      createPartFromBase64(wavBuffer.toString('base64'), 'audio/wav'),
      buildTranscribePrompt(languageCode),
    ]),
    config: {
      thinkingConfig: { thinkingLevel: STT_THINKING_LEVEL },
      httpOptions: {
        timeout: STT_TIMEOUT_MS,
        retryOptions: { attempts: STT_RETRY_ATTEMPTS, initialDelay: 0.5, maxDelay: 4 },
      },
    },
  });

  const transcription = String(response.text || '').trim();
  logger.info(`[geminiSpeechService] Transcription received via Gemini (lang=${languageCode}, ${transcription.length} chars)`);
  return transcription;
}

module.exports = {
  synthesizeSpeechStream,
  transcribeAudio,
  TTS_MODEL,
  STT_MODEL,
};
