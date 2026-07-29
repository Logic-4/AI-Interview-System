const { put, del } = require('@vercel/blob');
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

const uploadCandidateFile = async (fileBuffer, mimetype, originalname, folder = 'candidates') => {
  const ext = originalname ? originalname.split('.').pop() : 'bin';
  const filename = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.warn('BLOB_READ_WRITE_TOKEN not set in environment. Using data URI for local dev.');
    const base64 = fileBuffer.toString('base64');
    return { url: `data:${mimetype};base64,${base64}`, pathname: filename };
  }

  const blob = await put(filename, fileBuffer, {
    access: 'public',
    contentType: mimetype,
  });

  logger.info(`Candidate file uploaded to Vercel Blob: ${blob.url}`);
  return {
    url: blob.url,
    pathname: blob.pathname,
  };
};

const deleteBlobUrls = async (urls = []) => {
  const uniqueUrls = [...new Set(urls.filter((url) => typeof url === 'string' && url.trim()))];
  if (!uniqueUrls.length) return { deleted: 0, failed: [] };

  const results = await Promise.allSettled(uniqueUrls.map((url) => del(url)));
  const failed = results
    .map((result, index) => ({ result, url: uniqueUrls[index] }))
    .filter(({ result }) => result.status === 'rejected')
    .map(({ result, url }) => ({ url, error: result.reason?.message || String(result.reason) }));

  if (failed.length) logger.warn(`Failed to delete ${failed.length} blob(s): ${JSON.stringify(failed)}`);
  return { deleted: uniqueUrls.length - failed.length, failed };
};

module.exports = {
  uploadRecording,
  uploadAudio,
  uploadAvatar,
  uploadCandidateFile,
  deleteBlobUrls,
};
