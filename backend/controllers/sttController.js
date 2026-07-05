const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { transcribeAudio } = require('../services/somaliSpeechService');
const logger = require('../utils/logger');

// ─── In-memory multer — audio is proxied to ASR, never saved to disk ──────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30 MB max (long answers)
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('audio/') || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Expected an audio file.`));
    }
  },
});

// ─── POST /api/v1/stt/transcribe ──────────────────────────────────────────────
const transcribe = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('No audio file received. Send the recording as a multipart field named "audio".'));
    }

    const { buffer, originalname, mimetype } = req.file;
    logger.info(`[STT] Received audio: "${originalname}" (${mimetype}, ${(buffer.length / 1024).toFixed(1)} KB)`);

    const transcript = await transcribeAudio(
      buffer,
      originalname || 'answer.webm',
      mimetype || 'audio/webm'
    );

    logger.info(`[STT] Transcript (${transcript.length} chars): "${transcript.slice(0, 120)}"`);

    return res.status(200).json({
      success: true,
      transcript,
    });
  } catch (error) {
    logger.error(`[STT] Transcription failed: ${error.message}`);
    return next(ApiError.internal(`STT transcription failed: ${error.message}`));
  }
};

module.exports = { transcribe, upload };
