const ApiError = require('../utils/ApiError');
const { synthesizeSpeechStream } = require('../services/geminiSpeechService');
const { stageTimer } = require('../middleware/requestContext');

const synthesize = async (req, res, next) => {
  const { text, languageCode = 'en-US', language } = req.body || {};
  if (!text || !String(text).trim()) {
    return next(ApiError.badRequest('Text is required'));
  }

  const resolvedCode =
    language === 'somali' || String(languageCode).toLowerCase().startsWith('so')
      ? 'so-SO'
      : String(languageCode);

  const stopTts = stageTimer(req, 'tts_total', resolvedCode);
  let headersSent = false;
  try {
    const stream = synthesizeSpeechStream(String(text), resolvedCode);
    for await (const chunk of stream) {
      if (!headersSent) {
        res.setHeader('Content-Type', 'audio/pcm');
        res.setHeader('X-TTS-Provider', 'gemini');
        res.setHeader('X-TTS-Sample-Rate', '24000');
        res.setHeader('X-TTS-Bit-Depth', '16');
        res.setHeader('X-TTS-Channels', '1');
        res.setHeader('Cache-Control', 'no-store');
        res.status(200);
        headersSent = true;
      }
      res.write(chunk);
    }
    stopTts();
    if (!headersSent) {
      // Stream completed with no audio — treat as an error rather than
      // silently ending the response with an empty 200 body.
      return next(ApiError.internal('Speech synthesis returned no audio'));
    }
    res.end();
  } catch (error) {
    stopTts();
    if (headersSent) {
      // Can't change the status code mid-stream; just end the response.
      res.end();
      return;
    }
    return next(ApiError.internal(error.message));
  }
};

module.exports = {
  synthesize,
};
