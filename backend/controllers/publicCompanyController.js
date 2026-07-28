const Company = require('../models/Company');
const Job = require('../models/Job');

/**
 * @desc    Get public profile for a specific company
 * @route   GET /api/v1/public/companies/:companyId
 * @access  Public
 */
const getPublicCompanyProfile = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId).select(
      'name logo contactEmail phone website address description preferredLanguage status createdAt'
    );

    if (!company || company.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Company not found or inactive',
      });
    }

    res.status(200).json({
      success: true,
      data: { company },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all published jobs for a specific company
 * @route   GET /api/v1/public/companies/:companyId/jobs
 * @access  Public
 */
const getPublicCompanyJobs = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findById(companyId);
    if (!company || company.status !== 'active') {
      return res.status(404).json({
        success: false,
        message: 'Company not found or inactive',
      });
    }

    const jobs = await Job.find({ company: companyId, status: 'published' })
      .select('title department employmentType workplaceType location status description createdAt')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: { jobs, total: jobs.length },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get public details for a single job posting by ID
 * @route   GET /api/v1/public/companies/jobs/:jobId
 * @access  Public
 */
const getPublicJobDetails = async (req, res, next) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findById(jobId)
      .populate('company', 'name logo contactEmail phone website address description')
      .lean();

    if (!job || job.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or no longer active',
      });
    }

    res.status(200).json({
      success: true,
      data: { job },
    });
  } catch (error) {
    next(error);
  }
};

const Application = require('../models/Application');
const mongoose = require('mongoose');

/**
 * @desc    Submit a job application for a public job posting
 * @route   POST /api/v1/public/companies/jobs/:jobId/apply
 * @access  Public
 */
const applyPublicJob = async (req, res, next) => {
  try {
    const { jobId } = req.params;
    const {
      fullName,
      email,
      phone,
      profilePhotoUrl,
      resumeUrl,
      coverLetter,
      selectedInterviewDate,
      selectedInterviewTime,
    } = req.body;

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or no longer active',
      });
    }

    // Always required validation
    if (!fullName || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email, and Phone Number are required',
      });
    }

    // Dynamic backend verification based on Job settings
    if (job.resumeRequired && !resumeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Resume / CV upload is required for this job application',
      });
    }

    if (job.coverLetterRequired && !coverLetter) {
      return res.status(400).json({
        success: false,
        message: 'Cover Letter is required for this job application',
      });
    }

    // Create Application record
    const application = await Application.create({
      job: job._id,
      company: job.company,
      candidate: req.user?._id || new mongoose.Types.ObjectId(),
      candidateName: fullName,
      candidateEmail: email,
      candidatePhone: phone,
      profilePhotoUrl: profilePhotoUrl || '',
      resumeUrl: job.resumeRequired ? resumeUrl : '',
      resumeStatus: job.resumeRequired && resumeUrl ? 'uploaded' : 'missing',
      coverLetter: job.coverLetterRequired ? coverLetter : '',
      selectedInterviewDate: job.allowCandidateSelectTime && selectedInterviewDate ? selectedInterviewDate : null,
      selectedInterviewTime: job.allowCandidateSelectTime && selectedInterviewTime ? selectedInterviewTime : '',
      status: 'applied',
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { application },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An application with this email or user has already been submitted for this job',
      });
    }
    next(error);
  }
};

module.exports = {
  getPublicCompanyProfile,
  getPublicCompanyJobs,
  getPublicJobDetails,
  applyPublicJob,
};
