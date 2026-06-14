const { put } = require('@vercel/blob');
const logger = require('../utils/logger');

const uploadRecording = async (fileBuffer, userId, interviewId) => {
  const filename = `recordings/${userId}/interview_${interviewId}_${Date.now()}.webm`;
  const blob = await put(filename, fileBuffer, {
    access: 'public',
    contentType: 'audio/webm',
  });

  logger.info(`Recording uploaded to Vercel Blob: ${blob.pathname}`);
  return {
    url: blob.url,
    publicId: blob.pathname,
    duration: 0,
    format: 'webm',
    size: fileBuffer.length,
  };
};

const uploadAudio = async (fileBuffer, userId, questionId) => {
  const filename = `answers/${userId}/answer_${questionId}_${Date.now()}.webm`;
  const blob = await put(filename, fileBuffer, {
    access: 'public',
    contentType: 'audio/webm',
  });

  logger.info(`Audio uploaded to Vercel Blob: ${blob.pathname}`);
  return {
    url: blob.url,
    publicId: blob.pathname,
    duration: 0,
  };
};

const uploadAvatar = async (fileBuffer, userId) => {
  const filename = `avatars/avatar_${userId}.jpg`;
  const blob = await put(filename, fileBuffer, {
    access: 'public',
    contentType: 'image/jpeg',
  });

  logger.info(`Avatar uploaded to Vercel Blob: ${blob.pathname}`);
  return {
    url: blob.url,
    publicId: blob.pathname,
  };
};

module.exports = {
  uploadRecording,
  uploadAudio,
  uploadAvatar,
};
