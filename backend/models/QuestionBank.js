const mongoose = require('mongoose');

const questionBankSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: [true, 'Question text is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
    },
    domain: {
      type: String,
      required: [true, 'Domain is required'],
      enum: ['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'],
    },
    difficulty: {
      type: String,
      required: [true, 'Difficulty is required'],
      enum: ['easy', 'medium', 'hard'],
    },
    type: {
      type: String,
      required: [true, 'Type is required'],
      enum: ['technical', 'behavioral', 'system-design'],
    },
    sampleAnswer: {
      type: String,
      default: '',
    },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
questionBankSchema.index({ domain: 1, difficulty: 1, type: 1 });
questionBankSchema.index({ tags: 1 });
questionBankSchema.index({ isActive: 1 });
questionBankSchema.index({ category: 1 });

const QuestionBank = mongoose.model('QuestionBank', questionBankSchema);

module.exports = QuestionBank;
