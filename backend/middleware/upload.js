const multer = require('multer');
const path = require('path');
const ApiError = require('../utils/ApiError');

// Use memory storage — files go directly to Vercel Blob, not disk
const storage = multer.memoryStorage();

/**
 * File filter — allow only audio and video files
 */
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    // Audio
    'audio/mpeg',
    'audio/mp3',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'audio/m4a',
    'audio/x-m4a',
    // Video
    'video/mp4',
    'video/webm',
    'video/quicktime',
    'video/x-msvideo',
    // Images (for avatars)
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type '${file.mimetype}' is not supported. Allowed: audio, video, images.`), false);
  }
};

/**
 * Multer upload instance
 * Max file size: 50MB
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
});

module.exports = upload;
