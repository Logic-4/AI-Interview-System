const { GoogleGenAI, Modality, createUserContent, createPartFromBase64 } = require('@google/genai');
const logger = require('../utils/logger');
const { transcodeToWav } = require('./audioTranscodeService');

const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';
// gemini-2.5-flash (the old default here) is on Google's confirmed
// deprecation list, shutting down 2026-10-16 — fall back to the model
// GEMINI_STT_MODEL is actually pinned to in production instead, so an
// environment that forgets to set the env var doesn't silently hit a dead
// model after that date.
const STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-3.6-flash';
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
const TRANSCRIBE_PROMPT = 'Transcribe this English audio recording exactly as spoken. '
  + 'Return only the transcription text, with no commentary, labels, or additional formatting. '
  + 'If nothing intelligible was said, return an empty string.';
// Reuses the fast STT model — this is a short text-in/text-out correction
// pass, not a generation task, so no need for a separate model config.
const NORMALIZE_MODEL = process.env.GEMINI_NORMALIZE_MODEL || STT_MODEL;

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

/**
 * Builds the correction prompt for a raw Somali ASR transcript. Grounded in
 * the current interview question so the model can restore technical terms
 * the ASR mangled, without inventing content the candidate didn't say.
 */
function buildNormalizePrompt(rawTranscript, questionContext) {
  return [
    "You clean up a raw Somali speech-to-text transcript of a candidate's spoken answer in a job interview.",
    'The ASR model often mis-transcribes English technical terms embedded in Somali speech, mangles Somali-English',
    'suffix forms (e.g. "project ga" -> "project-ga", "API ga" -> "API-ga", "data bees" -> "database"), leaves',
    'fragmented or ungrammatical Somali, and inserts meaningless repeated or noise words.',
    '',
    'Fix ONLY transcription artifacts:',
    '- Correct obvious Somali grammar and transcription mistakes.',
    '- Restore likely technical terminology using the interview question below as context.',
    '- Correct Somali-English mixed terminology and suffix attachment.',
    '- Remove meaningless STT noise, duplicated words, and obvious transcription artifacts.',
    '- Reconstruct fragmented wording only when the intended meaning is clearly recoverable.',
    '',
    'Never do the following:',
    "- Do not change the candidate's claims, technical knowledge, mistakes, or level of detail.",
    '- Do not invent information, improve the answer, add explanations, or answer the question yourself.',
    '- If a word cannot be corrected with confidence, leave it exactly as transcribed rather than guessing.',
    '',
    `Interview question: ${questionContext || '(not available)'}`,
    '',
    `Raw transcript: ${rawTranscript}`,
    '',
    'Return ONLY the corrected transcript text, in Somali, with no commentary, labels, quotes, or formatting.',
  ].join('\n');
}

/**
 * Corrects a raw Somali ASR transcript before it is sent for evaluation.
 * Falls back to the raw transcript on empty input or empty model output —
 * callers should also catch errors and fall back, since a normalization
 * failure must never block scoring of an answer the candidate already gave.
 */
async function normalizeSomaliTranscript(rawTranscript, questionContext = '') {
  const cleaned = String(rawTranscript || '').trim();
  if (!cleaned) return cleaned;

  const ai = getClient();
  const startedAt = Date.now();
  const response = await ai.models.generateContent({
    model: NORMALIZE_MODEL,
    contents: buildNormalizePrompt(cleaned, questionContext),
  });

  const normalized = String(response.text || '').trim();
  logger.info(`[geminiSpeechService] Somali transcript normalized in ${Date.now() - startedAt}ms (${cleaned.length} -> ${normalized.length} chars)`);
  return normalized || cleaned;
}

module.exports = {
  synthesizeSpeechStream,
  transcribeAudioEnglish,
  normalizeSomaliTranscript,
  TTS_MODEL,
  STT_MODEL,
};
