const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    // New tenant-aware interviews are scoped to their owning company. Legacy
    // training interviews remain valid without a company during migration.
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Interview title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    type: {
      type: String,
      required: [true, 'Interview type is required'],
      enum: {
        values: ['technical', 'behavioral', 'system-design', 'hr', 'mixed'],
        message: 'Type must be technical, behavioral, system-design, hr, or mixed',
      },
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty level is required'],
      enum: {
        values: ['junior', 'mid', 'senior', 'lead'],
        message: 'Difficulty must be junior, mid, senior, or lead',
      },
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      trim: true,
      enum: {
        values: ['technology'],
        message: 'Only the technology domain is supported',
      },
    },

    language: {
      type: String,
      enum: {
        values: ['english', 'somali'],
        message: 'Language must be english or somali',
      },
      default: 'english',
    },
    jobRole: {
      type: String,
      trim: true,
      maxlength: [200, 'Job role cannot exceed 200 characters'],
      default: '',
    },
    focusSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    jobDescription: {
      type: String,
      default: '',
    },
    resumeText: {
      type: String,
      default: '',
    },
    roleProfile: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in-progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
    questions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
      },
    ],
    duration: {
      type: Number,
      default: 30, // minutes
      min: [5, 'Duration must be at least 5 minutes'],
      max: [120, 'Duration cannot exceed 120 minutes'],
    },
    scheduledAt: {
      type: Date,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    overallScore: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    recordingUrl: {
      type: String,
      default: '',
    },
    // Full-session webcam recording (video + audio), captured only for
    // company-scheduled interviews after the candidate consents. Chunks are
    // small immutable pieces uploaded during the live session; they are
    // byte-concatenated into recordingUrl once the interview completes, then
    // discarded.
    recordingChunks: [
      {
        index: { type: Number, required: true },
        url: { type: String, required: true },
        _id: false,
      },
    ],
    recordingStatus: {
      type: String,
      enum: ['none', 'recording', 'processing', 'ready', 'failed'],
      default: 'none',
    },
    transcription: {
      type: String,
      default: '',
    },
    aiModel: {
      type: String,
      default: 'gemma-3-technical-interviewer',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    conversationHistory: [
      {
        role: {
          type: String,
          enum: ['interviewer', 'candidate', 'system'],
        },
        content: String,
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    questionsReady: {
      type: Boolean,
      default: false,
    },
    generationStatus: {
      type: String,
      enum: ['queued', 'generating-first', 'generating-remaining', 'ready', 'partial', 'failed'],
      default: 'queued',
    },
    generationError: {
      type: String,
      default: '',
      maxlength: 500,
    },
    generationStartedAt: Date,
    firstQuestionReadyAt: Date,
    generationCompletedAt: Date,
    generationKey: {
      type: String,
      default: undefined,
      maxlength: 128,
    },
    expectedQuestionCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    // Distinguishes "candidate scored 0" from "AI/STT failure produced no
    // scores at all" so the company dashboard can flag interviews for human
    // review instead of misreporting them as failed.
    completionFlag: {
      type: String,
      enum: ['ok', 'no_valid_evaluations', 'abandoned'],
      default: 'ok',
      index: true,
    },
    // Pre-interview identity checkpoint (lobby face match). Legacy training
    // interviews without a company keep the default 'not_required'.
    identityVerification: {
      status: {
        type: String,
        enum: ['not_required', 'pending', 'passed', 'failed', 'blocked'],
        default: 'not_required',
      },
      similarity: { type: Number, default: null },
      threshold: { type: Number, default: null },
      provider: { type: String, default: '' },
      attempts: { type: Number, default: 0 },
      verifiedAt: { type: Date, default: null },
      lastAttemptAt: { type: Date, default: null },
      lastReason: { type: String, default: '', maxlength: 500 },
      // Snapshot of the live frame captured on the successful match; used by
      // the admin panel for later side-by-side comparison. Only populated on
      // a passed verification — failed attempts are never persisted.
      verifiedImageUrl: { type: String, default: '' },
    },
    proctoring: {
      enabled: { type: Boolean, default: false },
      strikes: { type: Number, default: 0, min: 0, max: 3 },
      integrityScore: { type: Number, default: 100, min: 0, max: 100 },
      violations: [
        {
          type: {
            type: String,
            enum: ['tab_switch', 'window_blur', 'gaze_away', 'face_not_detected'],
          },
          timestamp: { type: Date, default: Date.now },
          details: { type: String, default: '', maxlength: 500 },
          strike: { type: Number, default: null },
          _id: false,
        },
      ],
      flaggedForReview: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
// Covers both getInterviews's {user, status?} filter + createdAt:-1 sort in
// one index — makes the narrower {user:1,status:1} below redundant for that
// query, but it's kept for now since other lookups may still rely on it.
interviewSchema.index({ user: 1, status: 1, createdAt: -1 });
interviewSchema.index({ user: 1, status: 1 });
interviewSchema.index({ company: 1, createdAt: -1 });
// Covers companyPortalController's {company, status:'scheduled'|'completed'}
// queries, which the createdAt-sorted index above doesn't fully cover.
interviewSchema.index({ company: 1, status: 1 });
interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ type: 1, difficulty: 1 });
interviewSchema.index({ isDeleted: 1 });
interviewSchema.index(
  { user: 1, generationKey: 1 },
  { unique: true, partialFilterExpression: { generationKey: { $type: 'string' } } }
);

// Virtual — feedback
interviewSchema.virtual('feedback', {
  ref: 'Feedback',
  localField: '_id',
  foreignField: 'interview',
  justOne: true,
});

// Query middleware — exclude soft-deleted
interviewSchema.pre(/^find/, function (next) {
  if (this.getFilter().isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

// Pre-save — auto-set timestamps based on status
interviewSchema.pre('save', function (next) {
  if (this.isModified('status')) {
    if (this.status === 'in-progress' && !this.startedAt) {
      this.startedAt = new Date();
    }
    if (this.status === 'completed' && !this.completedAt) {
      this.completedAt = new Date();
    }
  }
  next();
});

const Interview = mongoose.model('Interview', interviewSchema);

module.exports = Interview;
