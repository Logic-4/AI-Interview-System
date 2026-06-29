const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: [true, 'Interview reference is required'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    categories: {
      communication: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        feedback: { type: String, default: '' },
      },
      technicalAccuracy: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        feedback: { type: String, default: '' },
      },
      problemSolving: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        feedback: { type: String, default: '' },
      },
      codeQuality: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        feedback: { type: String, default: '' },
      },
      confidence: {
        score: { type: Number, min: 0, max: 100, default: 0 },
        feedback: { type: String, default: '' },
      },
    },
    strengths: [
      {
        type: String,
        trim: true,
      },
    ],
    improvements: [
      {
        type: String,
        trim: true,
      },
    ],
    detailedFeedback: {
      type: String,
      default: '',
    },
    recommendations: [
      {
        type: String,
        trim: true,
      },
    ],
    visualMetrics: {
      type: mongoose.Schema.Types.Mixed,
      default: undefined,
    },
    aiModel: {
      type: String,
      default: 'gemma-3-technical-interviewer',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure one feedback per interview
feedbackSchema.index({ interview: 1 }, { unique: true });
feedbackSchema.index({ user: 1, createdAt: -1 });

const Feedback = mongoose.model('Feedback', feedbackSchema);

module.exports = Feedback;
