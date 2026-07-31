const logger = require('../utils/logger');

/**
 * Biometric face-matching for the pre-interview identity checkpoint.
 *
 * Provider is selected with FACE_VERIFICATION_PROVIDER:
 *   aws    — AWS Rekognition CompareFaces (requires @aws-sdk/client-rekognition)
 *   facepp — Face++ /facepp/v3/compare (no extra dependency)
 *   mock   — local development stub, always passes
 *   off    — verification disabled; the lobby is skipped entirely
 *
 * When unset, the provider is inferred from whichever credentials are present
 * and falls back to `off` so existing deployments keep working untouched.
 */

const DEFAULT_THRESHOLD = 85;
const DEFAULT_MAX_ATTEMPTS = 3;
const FETCH_TIMEOUT_MS = 15_000;

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function resolveProvider() {
  const explicit = env('FACE_VERIFICATION_PROVIDER').toLowerCase();
  if (explicit) return explicit;

  if (env('AWS_ACCESS_KEY_ID') && env('AWS_SECRET_ACCESS_KEY')) return 'aws';
  if (env('FACEPP_API_KEY') && env('FACEPP_API_SECRET')) return 'facepp';
  return 'off';
}

function getMatchThreshold() {
  const parsed = Number(env('FACE_MATCH_THRESHOLD', DEFAULT_THRESHOLD));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) return DEFAULT_THRESHOLD;
  return parsed;
}

function getMaxAttempts() {
  const parsed = Number(env('FACE_VERIFICATION_MAX_ATTEMPTS', DEFAULT_MAX_ATTEMPTS));
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_MAX_ATTEMPTS;
  return parsed;
}

function isVerificationEnabled() {
  return resolveProvider() !== 'off';
}

/* ─── Reference image loading ───────────────────────────── */

/**
 * Load a stored profile photo into a Buffer. Handles both Vercel Blob URLs and
 * the base64 data URIs blobService falls back to when running without a token.
 */
async function loadImageFromUrl(url) {
  const value = String(url || '').trim();
  if (!value) return null;

  if (value.startsWith('data:')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex === -1) return null;
    const meta = value.slice(5, commaIndex);
    const payload = value.slice(commaIndex + 1);
    if (!meta.includes('base64')) return null;
    const buffer = Buffer.from(payload, 'base64');
    return buffer.length ? buffer : null;
  }

  if (!/^https?:\/\//i.test(value)) return null;

  const response = await fetch(value, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Failed to download reference image (HTTP ${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.length ? buffer : null;
}

/* ─── AWS Rekognition adapter ───────────────────────────── */

let rekognitionClient;

function getRekognitionClient() {
  if (rekognitionClient) return rekognitionClient;

  let sdk;
  try {
    // Lazily required so the SDK is only a dependency for AWS deployments.
    // eslint-disable-next-line global-require
    sdk = require('@aws-sdk/client-rekognition');
  } catch {
    throw new Error(
      'AWS Rekognition provider selected but @aws-sdk/client-rekognition is not installed. Run: npm install @aws-sdk/client-rekognition'
    );
  }

  rekognitionClient = {
    client: new sdk.RekognitionClient({
      region: env('AWS_REGION', 'us-east-1'),
      credentials: env('AWS_ACCESS_KEY_ID')
        ? {
            accessKeyId: env('AWS_ACCESS_KEY_ID'),
            secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
            ...(env('AWS_SESSION_TOKEN') ? { sessionToken: env('AWS_SESSION_TOKEN') } : {}),
          }
        : undefined,
    }),
    CompareFacesCommand: sdk.CompareFacesCommand,
  };
  return rekognitionClient;
}

async function compareWithAws({ referenceBuffer, liveBuffer, threshold }) {
  const { client, CompareFacesCommand } = getRekognitionClient();

  let response;
  try {
    response = await client.send(
      new CompareFacesCommand({
        // Source must contain a single face — the stored profile photo.
        SourceImage: { Bytes: referenceBuffer },
        // Target is the live webcam frame, which may contain several people.
        TargetImage: { Bytes: liveBuffer },
        // Keep this low so we receive the real similarity and apply our own
        // threshold consistently across providers.
        SimilarityThreshold: 1,
        QualityFilter: 'AUTO',
      })
    );
  } catch (error) {
    const name = error?.name || '';
    if (name === 'InvalidParameterException') {
      // Rekognition throws this when it cannot detect a face in either image.
      return {
        outcome: 'no_face',
        similarity: null,
        facesDetected: 0,
        reason: 'No detectable face in the captured frame or the stored profile photo.',
      };
    }
    throw error;
  }

  const matches = response.FaceMatches || [];
  const unmatched = response.UnmatchedFaces || [];
  const facesDetected = matches.length + unmatched.length;

  if (facesDetected === 0) {
    return {
      outcome: 'no_face',
      similarity: null,
      facesDetected: 0,
      reason: 'No face detected in the live camera frame.',
    };
  }

  if (facesDetected > 1) {
    return {
      outcome: 'multiple_faces',
      similarity: matches.length ? Math.max(...matches.map((m) => m.Similarity || 0)) : null,
      facesDetected,
      reason: `${facesDetected} faces detected in the live frame. Only the candidate may be on camera.`,
    };
  }

  const similarity = matches.length ? Math.max(...matches.map((m) => m.Similarity || 0)) : 0;
  return {
    outcome: similarity >= threshold ? 'passed' : 'failed',
    similarity,
    facesDetected,
    reason:
      similarity >= threshold
        ? ''
        : `Face similarity ${similarity.toFixed(1)}% is below the required ${threshold}%.`,
  };
}

/* ─── Face++ adapter ────────────────────────────────────── */

async function compareWithFacePlusPlus({ referenceBuffer, liveBuffer, threshold }) {
  const apiKey = env('FACEPP_API_KEY');
  const apiSecret = env('FACEPP_API_SECRET');
  if (!apiKey || !apiSecret) {
    throw new Error('Face++ provider selected but FACEPP_API_KEY / FACEPP_API_SECRET are not set');
  }

  const endpoint = env('FACEPP_API_URL', 'https://api-us.faceplusplus.com/facepp/v3/compare');

  const form = new FormData();
  form.append('api_key', apiKey);
  form.append('api_secret', apiSecret);
  form.append('image_file1', new Blob([referenceBuffer], { type: 'image/jpeg' }), 'reference.jpg');
  form.append('image_file2', new Blob([liveBuffer], { type: 'image/jpeg' }), 'live.jpg');

  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error_message) {
    const message = payload.error_message || `HTTP ${response.status}`;
    if (/NO_FACE_FOUND|INVALID_IMAGE_FACE/i.test(message)) {
      return {
        outcome: 'no_face',
        similarity: null,
        facesDetected: 0,
        reason: 'No face detected in the live camera frame.',
      };
    }
    throw new Error(`Face++ compare failed: ${message}`);
  }

  const faces1 = payload.faces1 || [];
  const faces2 = payload.faces2 || [];
  if (!faces1.length) {
    return {
      outcome: 'no_reference',
      similarity: null,
      facesDetected: faces2.length,
      reason: 'No face could be detected in the stored profile photo.',
    };
  }
  if (!faces2.length) {
    return {
      outcome: 'no_face',
      similarity: null,
      facesDetected: 0,
      reason: 'No face detected in the live camera frame.',
    };
  }

  const similarity = Number(payload.confidence);
  if (!Number.isFinite(similarity)) {
    return {
      outcome: 'provider_error',
      similarity: null,
      facesDetected: faces2.length,
      reason: 'Face++ returned no confidence score.',
    };
  }

  return {
    outcome: similarity >= threshold ? 'passed' : 'failed',
    similarity,
    facesDetected: faces2.length,
    reason:
      similarity >= threshold
        ? ''
        : `Face similarity ${similarity.toFixed(1)}% is below the required ${threshold}%.`,
  };
}

/* ─── Mock adapter (local development) ──────────────────── */

async function compareWithMock({ liveBuffer, threshold }) {
  if (!liveBuffer?.length) {
    return {
      outcome: 'no_face',
      similarity: null,
      facesDetected: 0,
      reason: 'Empty capture received.',
    };
  }
  logger.warn('Face verification running in MOCK mode — no real biometric check performed');
  return {
    outcome: 'passed',
    similarity: Math.max(threshold, 99),
    facesDetected: 1,
    reason: '',
  };
}

/* ─── Public API ────────────────────────────────────────── */

/**
 * Compare a live webcam frame against a stored reference photo.
 *
 * @param {Object} params
 * @param {Buffer} params.liveBuffer      — snapshot captured in the lobby
 * @param {Buffer} [params.referenceBuffer] — stored profile photo bytes
 * @param {string} [params.referenceUrl]  — stored profile photo URL (loaded when no buffer given)
 * @returns {Promise<{outcome:string, similarity:number|null, threshold:number,
 *                    facesDetected:number, provider:string, reason:string}>}
 */
async function compareFaces({ liveBuffer, referenceBuffer, referenceUrl }) {
  const provider = resolveProvider();
  const threshold = getMatchThreshold();

  const base = { provider, threshold, similarity: null, facesDetected: 0, reason: '' };

  if (provider === 'off') {
    return { ...base, outcome: 'passed', reason: 'Identity verification is disabled.' };
  }

  if (!liveBuffer?.length) {
    return { ...base, outcome: 'no_face', reason: 'No camera frame was received.' };
  }

  let reference = referenceBuffer;
  if (!reference && provider !== 'mock') {
    try {
      reference = await loadImageFromUrl(referenceUrl);
    } catch (error) {
      logger.error(`Failed to load reference image for face verification: ${error.message}`);
      return { ...base, outcome: 'provider_error', reason: 'Stored profile photo could not be loaded.' };
    }
    if (!reference) {
      return {
        ...base,
        outcome: 'no_reference',
        reason: 'No profile photo is on file for this candidate.',
      };
    }
  }

  try {
    let result;
    if (provider === 'aws') {
      result = await compareWithAws({ referenceBuffer: reference, liveBuffer, threshold });
    } else if (provider === 'facepp') {
      result = await compareWithFacePlusPlus({ referenceBuffer: reference, liveBuffer, threshold });
    } else if (provider === 'mock') {
      result = await compareWithMock({ liveBuffer, threshold });
    } else {
      throw new Error(`Unknown FACE_VERIFICATION_PROVIDER '${provider}'`);
    }
    return { ...base, ...result, provider, threshold };
  } catch (error) {
    logger.error(`Face verification (${provider}) failed: ${error.message}`);
    return {
      ...base,
      outcome: 'provider_error',
      reason: error.message.slice(0, 400),
    };
  }
}

module.exports = {
  compareFaces,
  loadImageFromUrl,
  isVerificationEnabled,
  resolveProvider,
  getMatchThreshold,
  getMaxAttempts,
};
