const mongoose = require('mongoose');

/**
 * Immutable audit log of every identity-verification attempt made in the
 * pre-interview lobby. Company tenants read these to review impersonation
 * attempts; nothing in the app mutates an event except the `review*` fields.
 */
const verificationEventSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: true,
      index: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    candidateName: {
      type: String,
      default: '',
      trim: true,
    },
    outcome: {
      type: String,
      required: true,
      enum: [
        'passed',
        'failed', // faces compared, similarity below threshold
        'no_face', // no detectable face in the live frame
        'multiple_faces', // more than one person in frame
        'no_reference', // candidate has no stored profile photo
        'provider_error', // verification provider unreachable / errored
        'attempts_exhausted',
      ],
      index: true,
    },
    similarity: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
    threshold: {
      type: Number,
      default: null,
    },
    provider: {
      type: String,
      default: '',
    },
    attempt: {
      type: Number,
      default: 1,
    },
    facesDetected: {
      type: Number,
      default: 0,
    },
    reason: {
      type: String,
      default: '',
      maxlength: 500,
    },
    // Evidence — the live frame is retained only for non-passing attempts so
    // the tenant can review a suspected impersonation.
    liveFrameUrl: {
      type: String,
      default: '',
    },
    referenceImageUrl: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
    userAgent: {
      type: String,
      default: '',
      maxlength: 500,
    },
    severity: {
      type: String,
      enum: ['info', 'warning', 'critical'],
      default: 'info',
      index: true,
    },
    reviewed: {
      type: Boolean,
      default: false,
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  { timestamps: true }
);

verificationEventSchema.index({ company: 1, createdAt: -1 });
verificationEventSchema.index({ company: 1, reviewed: 1, severity: 1 });
verificationEventSchema.index({ interview: 1, createdAt: -1 });

module.exports = mongoose.model('VerificationEvent', verificationEventSchema);
