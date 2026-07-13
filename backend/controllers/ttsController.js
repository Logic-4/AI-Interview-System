const ApiError = require('../utils/ApiError');
const { synthesizeSpeech } = require('../services/somaliSpeechService');
const { stageTimer } = require('../middleware/requestContext');

const synthesize = async (req, res, next) => {
  try {
    const { text, languageCode = 'en-US', language } = req.body || {};
    if (!text || !String(text).trim()) {
      return next(ApiError.badRequest('Text is required'));
    }

    const resolvedCode =
      language === 'somali' || String(languageCode).toLowerCase().startsWith('so')
        ? 'so-SO'
        : String(languageCode);

    const stopTts = stageTimer(req, 'tts_total', resolvedCode);
    const { audio, contentType, provider, cacheStatus, totalMs } = await synthesizeSpeech(
      String(text),
      resolvedCode,
      { requestId: req.requestId }
    );
    stopTts();
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-TTS-Provider', provider || 'unknown');
    res.setHeader('X-TTS-Cache', cacheStatus || 'miss');
    if (Number.isFinite(totalMs)) res.setHeader('X-TTS-Duration-Ms', String(totalMs));
    return res.status(200).send(audio);
  } catch (error) {
    if (error.code === 'TTS_UNAVAILABLE' || error.code === 'TTS_TIMEOUT' || error.code === 'TTS_CIRCUIT_OPEN') {
      res.setHeader('Retry-After', '30');
      return next(ApiError.serviceUnavailable(
        'Speech audio is temporarily unavailable. Continue with text or retry shortly.',
        [{ code: error.code, providers: (error.attempts || []).map((item) => item.provider) }]
      ));
    }
    return next(ApiError.internal(error.message));
  }
};

module.exports = {
  synthesize,
};
