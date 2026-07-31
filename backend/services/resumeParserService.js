const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const logger = require('../utils/logger');

const MAX_RESUME_TEXT_LENGTH = 15000;

function normalizeText(text) {
  return (text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_RESUME_TEXT_LENGTH);
}

/**
 * Extracts plain text from a resume file buffer. Supports PDF, DOC/DOCX, and
 * plain text. Never throws — returns '' on failure so uploads are never blocked.
 */
async function parseResumeBuffer(buffer, mimetype, originalname = '') {
  const ext = (originalname.split('.').pop() || '').toLowerCase();

  try {
    if (mimetype === 'application/pdf' || ext === 'pdf') {
      const { text } = await pdfParse(buffer);
      return normalizeText(text);
    }

    if (
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || ext === 'docx'
      || ext === 'doc'
    ) {
      const { value } = await mammoth.extractRawText({ buffer });
      return normalizeText(value);
    }

    if (mimetype?.startsWith('text/') || ext === 'txt') {
      return normalizeText(buffer.toString('utf-8'));
    }

    return '';
  } catch (error) {
    logger.warn(`[resumeParserService] Failed to parse resume (${originalname}): ${error.message}`);
    return '';
  }
}

module.exports = {
  parseResumeBuffer,
};
