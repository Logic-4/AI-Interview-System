const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Company',
      required: [true, 'Company is required'],
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Section 1: Basic Job Information
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [150, 'Job title cannot exceed 150 characters'],
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required'],
      enum: {
        values: ['full-time', 'part-time', 'contract', 'internship'],
        message: 'Employment type must be full-time, part-time, contract, or internship',
      },
      default: 'full-time',
    },
    workplaceType: {
      type: String,
      required: [true, 'Workplace type is required'],
      enum: {
        values: ['on-site', 'remote', 'hybrid'],
        message: 'Workplace type must be on-site, remote, or hybrid',
      },
      default: 'on-site',
    },
    location: {
      type: String,
      required: [true, 'Location is required'],
      trim: true,
    },
    numberOfHiresNeeded: {
      type: Number,
      default: 1,
      min: [1, 'At least 1 hire is required'],
    },
    maxApplications: {
      type: Number,
      default: null,
    },
    // Incremented atomically alongside the maxApplications cap check in
    // applyPublicJob, so concurrent applications near the cap can't overshoot it.
    applicationCount: {
      type: Number,
      default: 0,
    },
    applicationDeadline: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'paused', 'closed'],
      default: 'published',
      index: true,
    },
    // Section 2: Job Details
    description: {
      type: String,
      required: [true, 'Job description is required'],
    },
    requiredSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    experienceLevel: {
      type: String,
      required: [true, 'Experience level is required'],
      enum: {
        values: ['junior', 'mid', 'senior', 'lead'],
        message: 'Experience level must be junior, mid, senior, or lead',
      },
      default: 'mid',
    },
    education: {
      type: String,
      default: '',
    },
    requiredEducation: {
      type: String,
      default: '',
    },
    // Section 3: Interview Configuration
    domain: {
      type: String,
      enum: {
        values: ['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'],
        message: 'Domain must be technology, healthcare, finance, engineering, education, or legal',
      },
      default: 'technology',
    },
    interviewLanguage: {
      type: String,
      enum: ['English', 'Somali'],
      default: 'English',
    },
    targetJobRole: {
      type: String,
      trim: true,
      default: '',
    },
    durationMinutes: {
      type: Number,
      default: 30,
      min: 5,
      max: 120,
    },
    focusSkills: [
      {
        type: String,
        trim: true,
      },
    ],
    numberOfQuestions: {
      type: Number,
      default: 5,
      min: 1,
      max: 20,
    },
    resumeRequired: {
      type: Boolean,
      default: true,
    },
    passingScoreThreshold: {
      type: Number,
      default: 70,
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

jobSchema.index({ company: 1, status: 1 });
jobSchema.index({ company: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);
