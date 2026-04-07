const { cloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

/**
 * Upload a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {Object} options - Upload options
 * @returns {Object} Cloudinary upload result
 */
const uploadToCloudinary = (fileBuffer, options = {}) => {
  return new Promise((resolve, reject) => {
    const defaultOptions = {
      folder: 'interviewai-pro',
      resource_type: 'auto',
      ...options,
    };

    const uploadStream = cloudinary.uploader.upload_stream(defaultOptions, (error, result) => {
      if (error) {
        logger.error(`Cloudinary upload failed: ${error.message}`);
        reject(new Error(`Upload failed: ${error.message}`));
      } else {
        logger.info(`File uploaded to Cloudinary: ${result.public_id}`);
        resolve(result);
      }
    });

    uploadStream.end(fileBuffer);
  });
};

/**
 * Upload a recording (video/audio) to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {string} userId - User ID for folder organization
 * @param {string} interviewId - Interview ID
 * @returns {Object} { url, publicId, duration }
 */
const uploadRecording = async (fileBuffer, userId, interviewId) => {
  const result = await uploadToCloudinary(fileBuffer, {
    folder: `interviewai-pro/recordings/${userId}`,
    resource_type: 'video',
    public_id: `interview_${interviewId}_${Date.now()}`,
    eager: [{ format: 'mp4', quality: 'auto' }],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    duration: result.duration || 0,
    format: result.format,
    size: result.bytes,
  };
};

/**
 * Upload an audio answer to Cloudinary
 * @param {Buffer} fileBuffer - Audio buffer
 * @param {string} userId - User ID
 * @param {string} questionId - Question ID
 * @returns {Object} { url, publicId }
 */
const uploadAudio = async (fileBuffer, userId, questionId) => {
  const result = await uploadToCloudinary(fileBuffer, {
    folder: `interviewai-pro/answers/${userId}`,
    resource_type: 'video', // Cloudinary uses 'video' for audio too
    public_id: `answer_${questionId}_${Date.now()}`,
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    duration: result.duration || 0,
  };
};

/**
 * Upload a user avatar to Cloudinary
 * @param {Buffer} fileBuffer - Image buffer
 * @param {string} userId - User ID
 * @returns {Object} { url, publicId }
 */
const uploadAvatar = async (fileBuffer, userId) => {
  const result = await uploadToCloudinary(fileBuffer, {
    folder: 'interviewai-pro/avatars',
    resource_type: 'image',
    public_id: `avatar_${userId}`,
    overwrite: true,
    transformation: [
      { width: 300, height: 300, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
  };
};

/**
 * Delete a file from Cloudinary
 * @param {string} publicId - Cloudinary public ID
 * @param {string} resourceType - Resource type (image, video, raw)
 */
const deleteFromCloudinary = async (publicId, resourceType = 'video') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    logger.info(`Deleted from Cloudinary: ${publicId}`);
    return result;
  } catch (error) {
    logger.error(`Cloudinary deletion failed: ${error.message}`);
    throw new Error(`Delete failed: ${error.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  uploadRecording,
  uploadAudio,
  uploadAvatar,
  deleteFromCloudinary,
};
