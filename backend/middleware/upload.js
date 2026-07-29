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
    // Documents (for resumes)
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/x-docx',
    'application/vnd.ms-word',
    'application/octet-stream',
  ];

  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.webp', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.mov', '.avi'];

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new ApiError(400, `File type '${file.mimetype}' is not supported. Allowed: pdf, doc, docx, audio, video, images.`), false);
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
