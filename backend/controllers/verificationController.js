const Interview = require('../models/Interview');
const Application = require('../models/Application');
const VerificationEvent = require('../models/VerificationEvent');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadCandidateFile } = require('../services/blobService');
const {
  compareFaces,
  isVerificationEnabled,
  resolveProvider,
  getMatchThreshold,
  getMaxAttempts,
} = require('../services/faceVerificationService');
const logger = require('../utils/logger');

const NON_PASS_SEVERITY = {
  failed: 'warning',
  multiple_faces: 'warning',
  no_face: 'info',
  no_reference: 'warning',
  provider_error: 'info',
  attempts_exhausted: 'critical',
};

const OUTCOME_MESSAGES = {
  passed: 'Identity confirmed. You may enter the interview.',
  failed: 'The live camera frame does not match the profile photo on file.',
  no_face: 'We could not detect a face. Center yourself in the frame with good lighting and try again.',
  multiple_faces: 'More than one person is visible. Only the candidate may be on camera.',
  no_reference: 'No profile photo is on file for this candidate, so identity cannot be verified.',
  provider_error: 'The verification service is temporarily unavailable. Please try again.',
  attempts_exhausted: 'Identity verification failed. Access to this interview has been blocked.',
};

/**
 * Resolve the reference profile photo for an interview's candidate.
 * The application photo submitted with the job application is authoritative;
 * the account avatar is a fallback for interviews created outside a pipeline.
 */
async function resolveReference(interview) {
  let application = null;

  if (interview.company) {
    application =
      (await Application.findOne({ interview: interview._id }).select('profilePhotoUrl candidateName').lean()) ||
      (await Application.findOne({ candidate: interview.user, company: interview.company })
        .select('profilePhotoUrl candidateName')
        .sort({ createdAt: -1 })
        .lean());
  }

  const applicationPhoto = String(application?.profilePhotoUrl || '').trim();
  const avatar = String(interview.user?.avatar || '').trim();

  return {
    application,
    referenceUrl: applicationPhoto || avatar,
    referenceSource: applicationPhoto ? 'application' : avatar ? 'avatar' : 'none',
  };
}

/**
 * Whether this interview must clear the identity checkpoint. Only tenant
 * (company-scoped) interviews are gated; personal training interviews are not.
 */
function requiresVerification(interview) {
  return Boolean(interview.company) && isVerificationEnabled();
}

function buildStatusPayload(interview, { referenceUrl, referenceSource, required }) {
  const iv = interview.identityVerification || {};
  const maxAttempts = getMaxAttempts();
  const attempts = iv.attempts || 0;

  return {
    required,
    status: required ? iv.status === 'not_required' ? 'pending' : iv.status : 'not_required',
    provider: required ? resolveProvider() : 'off',
    threshold: required ? getMatchThreshold() : null,
    similarity: iv.similarity ?? null,
    attempts,
    maxAttempts,
    attemptsRemaining: Math.max(0, maxAttempts - attempts),
    hasReferenceImage: Boolean(referenceUrl),
    referenceImageUrl: referenceUrl || '',
    referenceSource,
    lastReason: iv.lastReason || '',
    verifiedAt: iv.verifiedAt || null,
  };
}

/**
 * @desc    Read the identity checkpoint state for an interview
 * @route   GET /api/v1/interviews/:id/identity
 * @access  Private (candidate who owns the interview)
 */
const getIdentityStatus = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id }).populate(
      'user',
      'name avatar'
    );
    if (!interview) return next(ApiError.notFound('Interview not found'));

    const required = requiresVerification(interview);
    const { referenceUrl, referenceSource } = required
      ? await resolveReference(interview)
      : { referenceUrl: '', referenceSource: 'none' };

    ApiResponse.success(res, {
      verification: buildStatusPayload(interview, { referenceUrl, referenceSource, required }),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Match a live webcam frame against the stored profile photo
 * @route   POST /api/v1/interviews/:id/identity/verify
 * @access  Private (candidate who owns the interview)
 */
const verifyIdentity = async (req, res, next) => {
  try {
    if (!req.file?.buffer?.length) {
      return next(ApiError.badRequest('A captured camera frame is required'));
    }
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return next(ApiError.badRequest('The captured frame must be an image'));
    }

    const interview = await Interview.findOne({ _id: req.params.id, user: req.user._id }).populate(
      'user',
      'name avatar'
    );
    if (!interview) return next(ApiError.notFound('Interview not found'));

    if (interview.status === 'completed' || interview.status === 'cancelled') {
      return next(ApiError.badRequest(`Cannot verify identity for a ${interview.status} interview`));
    }

    const required = requiresVerification(interview);
    if (!required) {
      return ApiResponse.success(
        res,
        { verification: buildStatusPayload(interview, { referenceUrl: '', referenceSource: 'none', required }) },
        'Identity verification is not required for this interview'
      );
    }

    const iv = interview.identityVerification || {};
    if (iv.status === 'blocked') {
      return next(
        ApiError.forbidden('Identity verification failed. This interview has been blocked pending review.')
      );
    }

    const { application, referenceUrl, referenceSource } = await resolveReference(interview);
    const maxAttempts = getMaxAttempts();

    if ((iv.attempts || 0) >= maxAttempts) {
      interview.identityVerification.status = 'blocked';
      await interview.save();
      await logEvent(req, {
        interview,
        application,
        outcome: 'attempts_exhausted',
        result: { threshold: getMatchThreshold(), provider: resolveProvider(), similarity: null, facesDetected: 0 },
        reason: 'Maximum verification attempts reached.',
        referenceUrl,
        liveFrameUrl: '',
      });
      return next(ApiError.forbidden(OUTCOME_MESSAGES.attempts_exhausted));
    }

    const result = await compareFaces({
      liveBuffer: req.file.buffer,
      referenceUrl,
    });

    const passed = result.outcome === 'passed';
    // A provider outage must not consume the candidate's attempt budget.
    const consumesAttempt = result.outcome !== 'provider_error';

    interview.identityVerification.attempts = (iv.attempts || 0) + (consumesAttempt ? 1 : 0);
    interview.identityVerification.similarity = result.similarity ?? iv.similarity ?? null;
    interview.identityVerification.threshold = result.threshold;
    interview.identityVerification.provider = result.provider;
    interview.identityVerification.lastAttemptAt = new Date();
    interview.identityVerification.lastReason = result.reason || '';

    const attemptsExhausted =
      !passed && consumesAttempt && interview.identityVerification.attempts >= maxAttempts;

    if (passed) {
      interview.identityVerification.status = 'passed';
      interview.identityVerification.verifiedAt = new Date();
    } else if (attemptsExhausted) {
      interview.identityVerification.status = 'blocked';
    } else {
      interview.identityVerification.status = 'failed';
    }

    await interview.save();

    // Retain the live frame as evidence only when the check did not pass.
    let liveFrameUrl = '';
    if (!passed) {
      try {
        const uploaded = await uploadCandidateFile(
          req.file.buffer,
          req.file.mimetype || 'image/jpeg',
          `verification_${interview._id}_${Date.now()}.jpg`,
          'verification-evidence'
        );
        liveFrameUrl = uploaded.url;
      } catch (error) {
        logger.warn(`Could not store verification evidence frame: ${error.message}`);
      }
    }

    await logEvent(req, {
      interview,
      application,
      outcome: attemptsExhausted ? 'attempts_exhausted' : result.outcome,
      result,
      reason: result.reason,
      referenceUrl,
      liveFrameUrl,
    });

    const payload = {
      verification: buildStatusPayload(interview, { referenceUrl, referenceSource, required }),
      outcome: attemptsExhausted ? 'attempts_exhausted' : result.outcome,
      passed,
      message: OUTCOME_MESSAGES[attemptsExhausted ? 'attempts_exhausted' : result.outcome] || result.reason,
    };

    if (attemptsExhausted) {
      return res.status(403).json({
        statusCode: 403,
        success: false,
        message: OUTCOME_MESSAGES.attempts_exhausted,
        data: payload,
      });
    }

    ApiResponse.success(res, payload, payload.message);
  } catch (error) {
    next(error);
  }
};

async function logEvent(req, { interview, application, outcome, result, reason, referenceUrl, liveFrameUrl }) {
  try {
    await VerificationEvent.create({
      company: interview.company || null,
      interview: interview._id,
      application: application?._id || null,
      candidate: interview.user?._id || interview.user,
      candidateName: application?.candidateName || interview.user?.name || '',
      outcome,
      similarity: result.similarity ?? null,
      threshold: result.threshold ?? null,
      provider: result.provider || '',
      attempt: interview.identityVerification?.attempts || 0,
      facesDetected: result.facesDetected || 0,
      reason: String(reason || '').slice(0, 500),
      liveFrameUrl: liveFrameUrl || '',
      referenceImageUrl: referenceUrl || '',
      ipAddress: req.ip || req.headers['x-forwarded-for'] || '',
      userAgent: String(req.get('user-agent') || '').slice(0, 500),
      severity: outcome === 'passed' ? 'info' : NON_PASS_SEVERITY[outcome] || 'warning',
    });
  } catch (error) {
    // Audit logging must never break the candidate's verification flow.
    logger.error(`Failed to record verification event: ${error.message}`);
  }
}

module.exports = {
  getIdentityStatus,
  verifyIdentity,
  requiresVerification,
  resolveReference,
};
