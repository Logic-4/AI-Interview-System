const mongoose = require('mongoose');

const interviewSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
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
        values: ['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'],
        message: 'Invalid domain',
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
    visualMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
interviewSchema.index({ user: 1, status: 1 });
interviewSchema.index({ user: 1, createdAt: -1 });
interviewSchema.index({ type: 1, difficulty: 1 });
interviewSchema.index({ isDeleted: 1 });

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
