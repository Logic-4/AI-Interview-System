const { uploadCandidateFile, deleteBlobUrls } = require('./blobService');
const logger = require('./../utils/logger');

const FETCH_TIMEOUT_MS = 30_000;

/**
 * Full-session webcam recording for company-scheduled interviews.
 *
 * The client uploads small, immutable chunks throughout the live session
 * (one MediaRecorder instance, periodic `ondataavailable` via a timeslice).
 * Because those chunks are sequential byte-ranges of a single continuous
 * recording — not independently-encoded files — concatenating their raw
 * bytes in order reconstructs a byte-perfect, fully valid video. No
 * transcoding step is required.
 */

function requiresRecording(interview) {
  return Boolean(interview.company);
}

async function uploadChunk(buffer, userId, interviewId, index) {
  const folder = `recordings/${userId}/${interviewId}`;
  const result = await uploadCandidateFile(buffer, 'video/webm', `chunk_${String(index).padStart(5, '0')}.webm`, folder);
  return result.url;
}

async function loadBufferFromUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex === -1) return null;
    const meta = value.slice(5, commaIndex);
    if (!meta.includes('base64')) return null;
    return Buffer.from(value.slice(commaIndex + 1), 'base64');
  }

  if (!/^https?:\/\//i.test(value)) return null;
  const response = await fetch(value, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`Failed to download recording chunk (HTTP ${response.status})`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Reassembles the uploaded chunks into a single recording, uploads it, and
 * discards the intermediate chunk blobs. Safe to call even with zero or one
 * chunk. Never throws for a partial/failed chunk download — the finalized
 * recording just proceeds with whatever chunks it could recover.
 */
async function finalizeRecording(interview) {
  const chunks = [...(interview.recordingChunks || [])].sort((a, b) => a.index - b.index);
  if (!chunks.length) {
    return { url: '', recovered: 0, expected: 0 };
  }

  const buffers = [];
  for (const chunk of chunks) {
    try {
      const buffer = await loadBufferFromUrl(chunk.url);
      if (buffer?.length) buffers.push(buffer);
    } catch (error) {
      logger.warn(`Recording chunk ${chunk.index} for interview ${interview._id} could not be downloaded: ${error.message}`);
    }
  }

  if (!buffers.length) {
    return { url: '', recovered: 0, expected: chunks.length };
  }

  const combined = Buffer.concat(buffers);
  const userId = String(interview.user?._id || interview.user);
  const result = await uploadCandidateFile(combined, 'video/webm', 'session_recording.webm', `recordings/${userId}/${interview._id}`);

  // Best-effort cleanup — a failure here must not fail the finalize step,
  // the interview already has its final recordingUrl at this point.
  deleteBlobUrls(chunks.map((c) => c.url)).catch((error) =>
    logger.warn(`Failed to clean up recording chunks for interview ${interview._id}: ${error.message}`)
  );

  return { url: result.url, recovered: buffers.length, expected: chunks.length };
}

module.exports = { requiresRecording, uploadChunk, finalizeRecording };
