const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema(
  {
    job: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: [true, 'Job is required'],
      index: true,
    },
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
    candidateName: {
      type: String,
      required: true,
      trim: true,
    },
    candidateEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    candidatePhone: {
      type: String,
      default: '',
      trim: true,
    },
    profilePhotoUrl: {
      type: String,
      default: '',
    },
    resumeUrl: {
      type: String,
      default: '',
    },
    resumeStatus: {
      type: String,
      enum: ['uploaded', 'missing', 'reviewed'],
      default: 'uploaded',
    },
    coverLetter: {
      type: String,
      default: '',
    },
    selectedInterviewDate: {
      type: Date,
      default: null,
    },
    selectedInterviewTime: {
      type: String,
      default: '',
      trim: true,
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['applied', 'under_review', 'interview_scheduled', 'interviewed', 'shortlisted', 'rejected', 'hired'],
      default: 'applied',
      index: true,
    },
    isShortlisted: {
      type: Boolean,
      default: false,
      index: true,
    },
    interviewStatus: {
      type: String,
      enum: ['not_scheduled', 'scheduled', 'completed', 'cancelled'],
      default: 'not_scheduled',
    },
    interview: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Interview',
      default: null,
    },
    overallScore: {
      type: Number,
      default: null,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

applicationSchema.index({ company: 1, status: 1 });
applicationSchema.index({ company: 1, isShortlisted: 1 });
applicationSchema.index({ job: 1, candidate: 1 }, { unique: true });
applicationSchema.index(
  { job: 1, candidateEmail: 1, candidatePhone: 1 },
  { unique: true, name: 'unique_job_email_phone' }
);

module.exports = mongoose.model('Application', applicationSchema);
