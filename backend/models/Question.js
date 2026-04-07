const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema(
  {
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      required: [true, 'Interview reference is required'],
      index: true,
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
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient ordering
questionSchema.index({ interview: 1, order: 1 });

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;
