const ApiError = require('../utils/ApiError');
const { synthesizeSpeech } = require('../services/somaliSpeechService');

const synthesize = async (req, res, next) => {
  try {
    const { text, languageCode = 'en-US' } = req.body || {};
    if (!text || !String(text).trim()) {
      return next(ApiError.badRequest('Text is required'));
    }

    const { audio, contentType } = await synthesizeSpeech(String(text), String(languageCode));
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).send(audio);
  } catch (error) {
    return next(ApiError.internal(error.message));
  }
};

module.exports = {
  synthesize,
};
