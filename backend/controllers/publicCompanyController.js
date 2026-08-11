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
 * @desc    Get all published jobs across all active companies
 * @route   GET /api/v1/public/companies/jobs
 * @access  Public
 */
const getAllPublicJobs = async (req, res, next) => {
  try {
    // ponytail: fixed limit of 50, add cursor pagination when job count grows
    const jobs = await Job.find({ status: 'published' })
      .populate('company', 'name logo')
      .select('title employmentType workplaceType location applicationDeadline requiredSkills experienceLevel resumeRequired createdAt company')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, data: { jobs, total: jobs.length } });
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
      .select('title employmentType workplaceType location status description createdAt')
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
const User = require('../models/User');
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
      resumeText, // trusted only when it came back from /upload-blob for this
                  // exact resumeUrl. We do NOT stuff it into the interview
                  // prompt directly to avoid prompt injection via applicants.
      coverLetter,
    } = req.body;

    const job = await Job.findById(jobId);
    if (!job || job.status !== 'published') {
      return res.status(404).json({
        success: false,
        message: 'Job posting not found or no longer active',
      });
    }

    // Enforce application deadline — a schema field that used to be ignored.
    if (job.applicationDeadline && Date.now() > new Date(job.applicationDeadline).getTime()) {
      return res.status(410).json({
        success: false,
        message: 'The application window for this job has closed.',
      });
    }

    // Enforce max application cap.
    if (typeof job.maxApplications === 'number' && job.maxApplications > 0) {
      const current = await Application.countDocuments({ job: job._id });
      if (current >= job.maxApplications) {
        return res.status(409).json({
          success: false,
          message: 'This job posting is no longer accepting new applications.',
        });
      }
    }

    // Always required validation with strict format checks
    const trimmedName = String(fullName || '').trim();
    const trimmedEmail = String(email || '').trim().toLowerCase();
    const trimmedPhone = String(phone || '').trim();

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Full Name, Email, and Phone Number are required',
      });
    }

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Full Name must be between 2 and 100 characters',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address',
      });
    }

    const phoneDigits = trimmedPhone.replace(/\D/g, '');
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid phone number (7 to 15 digits)',
      });
    }

    // Dynamic backend verification based on Job settings
    if (job.resumeRequired && !resumeUrl) {
      return res.status(400).json({
        success: false,
        message: 'Resume / CV upload is required for this job application',
      });
    }


    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = phone.trim();

    // Resolve or create a candidate User account. Match candidate or user roles.
    let candidateUser = req.user || null;
    if (!candidateUser && normalizedEmail) {
      candidateUser = await User.findOne({ email: normalizedEmail, role: { $in: ['user', 'candidate'] } });
    }

    if (!candidateUser) {
      const conflict = await User.findOne({ email: normalizedEmail }).select('_id role').lean();
      if (conflict) {
        return res.status(400).json({
          success: false,
          message: 'This email belongs to an employer or admin account. Please sign in or use a candidate email.',
        });
      }
      candidateUser = await User.create({
        name: fullName.trim(),
        email: normalizedEmail,
        role: 'candidate',
      });
    }

    // ─── Per-Job Duplicate Application Check ─────────────────────────────────
    const duplicateOr = [{ candidateEmail: normalizedEmail }];
    if (candidateUser) {
      duplicateOr.push({ candidate: candidateUser._id });
    }

    const existingApplication = await Application.findOne({
      job: job._id,
      $or: duplicateOr,
    });

    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied for this job.',
      });
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Cap the client-supplied resumeText and strip control chars — the file
    // itself is authoritative and can be re-parsed server-side. This keeps
    // any prompt-injection payload the applicant might have swapped in from
    // ballooning into the interview prompt.
    const safeResumeText = job.resumeRequired
      ? String(resumeText || '').replace(/[ --]/g, '').slice(0, 50000)
      : '';

    // Create Application record
    const application = await Application.create({
      job: job._id,
      company: job.company,
      candidate: candidateUser._id,
      candidateName: fullName,
      candidateEmail: email,
      candidatePhone: phone,
      profilePhotoUrl: profilePhotoUrl || '',
      resumeUrl: job.resumeRequired ? resumeUrl : '',
      resumeText: safeResumeText,
      resumeStatus: job.resumeRequired && resumeUrl ? 'uploaded' : 'missing',
      coverLetter: '',
      selectedInterviewDate: null,
      selectedInterviewTime: '',
      status: 'applied',
    });

    res.status(201).json({
      success: true,
      message: 'Application submitted successfully',
      data: { application },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied for this job.',
      });
    }
    next(error);
  }
};

const { uploadCandidateFile } = require('../services/blobService');
const { parseResumeBuffer } = require('../services/resumeParserService');

/**
 * @desc    Upload candidate profile photo or resume directly to Vercel Blob
 * @route   POST /api/v1/public/companies/upload-blob
 * @access  Public
 */
const uploadCandidateBlobFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a valid file (image or PDF/DOCX document)',
      });
    }

    const folder = req.body.folder || 'candidate-files';
    const [result, resumeText] = await Promise.all([
      uploadCandidateFile(req.file.buffer, req.file.mimetype, req.file.originalname, folder),
      folder === 'resumes'
        ? parseResumeBuffer(req.file.buffer, req.file.mimetype, req.file.originalname)
        : Promise.resolve(''),
    ]);

    res.status(200).json({
      success: true,
      message: 'File uploaded to Vercel Blob successfully',
      data: { url: result.url, resumeText },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllPublicJobs,
  getPublicCompanyProfile,
  getPublicCompanyJobs,
  getPublicJobDetails,
  applyPublicJob,
  uploadCandidateBlobFile,
};
