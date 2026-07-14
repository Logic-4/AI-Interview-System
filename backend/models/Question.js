const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: [true, 'Interview reference is required'],
    },
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: 'general',
    },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard'],
      default: 'medium',
    },
    expectedAnswer: {
      type: String,
      default: '',
    },
    userAnswer: {
      type: String,
      default: '',
    },
    audioUrl: {
      type: String,
      default: '',
    },
    score: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },
    evaluationStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'invalid'],
      default: 'pending',
      index: true,
    },
    aiFeedback: {
      type: String,
      default: '',
    },
    timeSpent: {
      type: Number, // seconds
      default: 0,
    },
    order: {
      type: Number,
      required: true,
      default: 0,
    },
    isAnswered: {
      type: Boolean,
      default: false,
    },
    retryAnswers: [
      {
        answer: { type: String, required: true },
        score: { type: Number, min: 0, max: 100, default: null },
        feedback: { type: String, default: '' },
        strengths: [String],
        improvements: [String],
        suggestedAnswer: { type: String, default: '' },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient ordering
questionSchema.index({ interview: 1, order: 1 }, { unique: true });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
