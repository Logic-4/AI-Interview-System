const mongoose = require('mongoose');

const assessmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      index: true,
    },
    candidate: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Candidate is required'],
      index: true,
    },
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Application',
      default: null,
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
    },
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    assessmentType: {
      type: String,
      required: true,
      default: 'AI Mock Interview Assessment',
    },
    score: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    passingScore: {
      type: Number,
      default: 70,
    },
    passFailStatus: {
      type: String,
      enum: ['passed', 'failed', 'pending'],
      default: 'pending',
    },
    completionDate: {
      type: Date,
      default: Date.now,
    },
    summaryNotes: {
      type: String,
      default: '',
    },
    strengths: [
      {
        type: String,
      },
    ],
    improvements: [
      {
        type: String,
      },
    ],
    detailedCategoryScores: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

assessmentSchema.index({ company: 1, completionDate: -1 });

module.exports = mongoose.model('Assessment', assessmentSchema);
