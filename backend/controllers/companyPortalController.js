const Job = require('../models/Job');
const Application = require('../models/Application');
const Candidate = require('../models/User');
const Interview = require('../models/Interview');
const Assessment = require('../models/Assessment');
const Company = require('../models/Company');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const normalizePagination = (value, fallback, max) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), max);

// ─── DASHBOARD ──────────────────────────────────────────
const getDashboard = async (req, res, next) => {
  try {
    const companyId = req.companyId;

    const [
      totalJobs,
      activeJobs,
      draftJobs,
      totalApplications,
      candidatesInterviewed,
      candidatesShortlisted,
      pendingInterviews,
      recentApplications,
      upcomingInterviews,
    ] = await Promise.all([
      Job.countDocuments({ company: companyId }),
      Job.countDocuments({ company: companyId, status: 'published' }),
      Job.countDocuments({ company: companyId, status: 'draft' }),
      Application.countDocuments({ company: companyId }),
      Application.countDocuments({ company: companyId, status: 'interviewed' }),
      Application.countDocuments({ company: companyId, isShortlisted: true }),
      Interview.countDocuments({ company: companyId, status: 'scheduled' }),

      Application.find({ company: companyId })
        .populate('job', 'title department')
        .populate('candidate', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Interview.find({ company: companyId, status: 'scheduled' })
        .populate('user', 'name email avatar')
        .sort({ scheduledAt: 1 })
        .limit(5)
        .lean(),
    ]);

    // Build latest activity items
    const recentJobs = await Job.find({ company: companyId }).sort({ createdAt: -1 }).limit(3).lean();
    const activities = [
      ...recentApplications.map((app) => ({
        id: app._id,
        type: 'application',
        title: `New application received for ${app.job?.title || 'a role'}`,
        subtitle: `Candidate: ${app.candidateName}`,
        timestamp: app.createdAt,
      })),
      ...recentJobs.map((j) => ({
        id: j._id,
        type: 'job',
        title: `Job posting "${j.title}" (${j.status})`,
        subtitle: `Department: ${j.department}`,
        timestamp: j.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    ApiResponse.success(res, {
      metrics: {
        totalJobs,
        activeJobs,
        draftJobs,
        totalApplications,
        candidatesInterviewed,
        candidatesShortlisted,
        pendingInterviews,
      },
      recentApplications,
      upcomingInterviews,
      latestActivity: activities,
    });
  } catch (error) {
    next(error);
  }
};

// ─── JOBS ───────────────────────────────────────────────
const getJobs = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { search = '', status = '', department = '' } = req.query;

    const filter = { company: req.companyId };
    if (status) filter.status = status;
    if (department) filter.department = department;
    if (search.trim()) {
      filter.title = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }

    const [jobs, total] = await Promise.all([
      Job.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Job.countDocuments(filter),
    ]);

    // Attach application counts per job
    const jobsWithCounts = await Promise.all(
      jobs.map(async (j) => {
        const appCount = await Application.countDocuments({ job: j._id });
        return { ...j, applicationCount: appCount };
      })
    );

    ApiResponse.success(res, {
      jobs: jobsWithCounts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getJobById = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, company: req.companyId }).lean();
    if (!job) return next(ApiError.notFound('Job not found'));
    const applicationCount = await Application.countDocuments({ job: job._id });
    ApiResponse.success(res, { job: { ...job, applicationCount } });
  } catch (error) {
    next(error);
  }
};

const createJob = async (req, res, next) => {
  try {
    const jobPayload = {
      ...req.body,
      company: req.companyId,
      createdBy: req.user._id,
    };
    const job = await Job.create(jobPayload);
    ApiResponse.created(res, { job }, 'Job created successfully');
  } catch (error) {
    next(error);
  }
};

const updateJob = async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id, company: req.companyId });
    if (!job) return next(ApiError.notFound('Job not found'));

    Object.assign(job, req.body);
    await job.save();
    ApiResponse.success(res, { job }, 'Job updated successfully');
  } catch (error) {
    next(error);
  }
};

const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findOneAndDelete({ _id: req.params.id, company: req.companyId });
    if (!job) return next(ApiError.notFound('Job not found'));
    ApiResponse.success(res, null, 'Job deleted successfully');
  } catch (error) {
    next(error);
  }
};

// ─── APPLICATIONS ───────────────────────────────────────
const getApplications = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { search = '', status = '', jobId = '', shortlisted = '' } = req.query;

    const filter = { company: req.companyId };
    if (status) filter.status = status;
    if (jobId) filter.job = jobId;
    if (shortlisted === 'true') filter.isShortlisted = true;
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ candidateName: pattern }, { candidateEmail: pattern }];
    }

    const [applications, total] = await Promise.all([
      Application.find(filter)
        .populate('job', 'title department experienceLevel')
        .populate('candidate', 'name email avatar skills experienceLevel')
        .populate('interview', 'overallScore status type language duration scheduledAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Application.countDocuments(filter),
    ]);

    ApiResponse.success(res, {
      applications,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId })
      .populate('job')
      .populate('candidate', 'name email avatar bio skills targetRole experienceLevel')
      .populate({
        path: 'interview',
        populate: { path: 'feedback' },
      })
      .lean();

    if (!application) return next(ApiError.notFound('Application not found'));
    ApiResponse.success(res, { application });
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, isShortlisted } = req.body;
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));

    if (status !== undefined) application.status = status;
    if (isShortlisted !== undefined) application.isShortlisted = isShortlisted;

    await application.save();
    ApiResponse.success(res, { application }, 'Application status updated');
  } catch (error) {
    next(error);
  }
};

// ─── CANDIDATES & SHORTLIST ──────────────────────────────
const getCandidates = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { search = '', status = '', experienceLevel = '' } = req.query;

    const filter = { company: req.companyId };
    if (status) filter.status = status;
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ candidateName: pattern }, { candidateEmail: pattern }];
    }

    const applications = await Application.find(filter)
      .populate('job', 'title department')
      .populate('candidate', 'name email avatar experienceLevel skills')
      .populate('interview', 'overallScore status')
      .sort({ createdAt: -1 })
      .lean();

    // Group or format candidates
    let candidates = applications.map((app) => ({
      _id: app._id,
      candidateId: app.candidate?._id || app._id,
      name: app.candidateName,
      email: app.candidateEmail,
      appliedPosition: app.job?.title || 'N/A',
      jobId: app.job?._id,
      experienceLevel: app.candidate?.experienceLevel || 'Mid',
      interviewScore: app.overallScore ?? app.interview?.overallScore ?? null,
      status: app.status,
      isShortlisted: app.isShortlisted,
      appliedDate: app.appliedDate,
      avatar: app.candidate?.avatar || '',
      skills: app.candidate?.skills || [],
    }));

    if (experienceLevel) {
      candidates = candidates.filter((c) => c.experienceLevel.toLowerCase() === experienceLevel.toLowerCase());
    }

    const total = candidates.length;
    const paginated = candidates.slice((page - 1) * limit, page * limit);

    ApiResponse.success(res, {
      candidates: paginated,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const toggleShortlist = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application/Candidate record not found'));

    application.isShortlisted = !application.isShortlisted;
    if (application.isShortlisted && application.status === 'applied') {
      application.status = 'shortlisted';
    }
    await application.save();

    ApiResponse.success(
      res,
      { application },
      application.isShortlisted ? 'Candidate added to shortlist' : 'Candidate removed from shortlist'
    );
  } catch (error) {
    next(error);
  }
};

const rejectCandidate = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));

    application.status = 'rejected';
    application.isShortlisted = false;
    await application.save();

    ApiResponse.success(res, { application }, 'Candidate marked as rejected');
  } catch (error) {
    next(error);
  }
};

// ─── INTERVIEWS ──────────────────────────────────────────
const getInterviews = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { search = '', status = '', type = '', language = '' } = req.query;

    const filter = { company: req.companyId };
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (language) filter.language = language;

    const [interviews, total] = await Promise.all([
      Interview.find(filter)
        .populate('user', 'name email avatar')
        .populate('feedback', 'overallScore summary strengths improvements')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Interview.countDocuments(filter),
    ]);

    ApiResponse.success(res, {
      interviews,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const scheduleInterview = async (req, res, next) => {
  try {
    const { applicationId, candidateId, jobRole, type = 'mixed', difficulty = 'mid', domain = 'technology', language = 'english', duration = 30, scheduledAt } = req.body;

    let candidate = null;
    let application = null;

    if (applicationId) {
      application = await Application.findOne({ _id: applicationId, company: req.companyId });
      if (application) candidateId = application.candidate;
    }

    if (!candidateId) return next(ApiError.badRequest('Candidate is required for scheduling an interview'));

    candidate = await User.findById(candidateId);
    if (!candidate) return next(ApiError.notFound('Candidate user not found'));

    const interview = await Interview.create({
      user: candidate._id,
      company: req.companyId,
      title: `${jobRole || 'Company'} Interview - ${candidate.name}`,
      type,
      difficulty,
      domain,
      language: language.toLowerCase(),
      jobRole: jobRole || 'Candidate',
      duration,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : new Date(),
      status: 'scheduled',
    });

    if (application) {
      application.interview = interview._id;
      application.interviewStatus = 'scheduled';
      application.status = 'interview_scheduled';
      await application.save();
    }

    ApiResponse.created(res, { interview }, 'Interview scheduled successfully');
  } catch (error) {
    next(error);
  }
};

const rescheduleInterview = async (req, res, next) => {
  try {
    const { scheduledAt } = req.body;
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId });
    if (!interview) return next(ApiError.notFound('Interview not found'));

    interview.scheduledAt = new Date(scheduledAt);
    interview.status = 'scheduled';
    await interview.save();

    ApiResponse.success(res, { interview }, 'Interview rescheduled successfully');
  } catch (error) {
    next(error);
  }
};

const cancelInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId });
    if (!interview) return next(ApiError.notFound('Interview not found'));

    interview.status = 'cancelled';
    await interview.save();

    ApiResponse.success(res, { interview }, 'Interview cancelled successfully');
  } catch (error) {
    next(error);
  }
};

const getInterviewResults = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId })
      .populate('user', 'name email avatar')
      .populate('questions')
      .populate('feedback')
      .lean();

    if (!interview) return next(ApiError.notFound('Interview not found'));
    ApiResponse.success(res, { interview });
  } catch (error) {
    next(error);
  }
};

// ─── ASSESSMENTS ─────────────────────────────────────────
const getAssessments = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { passFailStatus = '' } = req.query;

    const filter = { company: req.companyId };
    if (passFailStatus) filter.passFailStatus = passFailStatus;

    const [assessments, total] = await Promise.all([
      Assessment.find(filter)
        .populate('candidate', 'name email avatar')
        .populate('job', 'title department')
        .sort({ completionDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Assessment.countDocuments(filter),
    ]);

    // If no explicit assessments exist yet, populate from completed interviews for this company
    if (assessments.length === 0) {
      const completedInterviews = await Interview.find({ company: req.companyId, status: 'completed' })
        .populate('user', 'name email avatar')
        .populate('feedback')
        .sort({ completedAt: -1 })
        .lean();

      const synthesizedAssessments = completedInterviews.map((inv) => {
        const score = inv.overallScore ?? inv.feedback?.overallScore ?? 0;
        return {
          _id: inv._id,
          candidate: inv.user,
          candidateName: inv.user?.name || 'Candidate',
          job: { title: inv.jobRole || inv.title || 'Technical Assessment' },
          assessmentType: `${inv.type.toUpperCase()} AI Evaluation`,
          score,
          passingScore: 70,
          passFailStatus: score >= 70 ? 'passed' : 'failed',
          completionDate: inv.completedAt || inv.updatedAt,
          summaryNotes: inv.feedback?.summary || 'Completed automated AI Mock Interview evaluation.',
          strengths: inv.feedback?.strengths || [],
          improvements: inv.feedback?.improvements || [],
        };
      });

      return ApiResponse.success(res, {
        assessments: synthesizedAssessments.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: synthesizedAssessments.length, totalPages: Math.ceil(synthesizedAssessments.length / limit) },
      });
    }

    ApiResponse.success(res, {
      assessments,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

const getAssessmentById = async (req, res, next) => {
  try {
    const assessment = await Assessment.findOne({ _id: req.params.id, company: req.companyId })
      .populate('candidate', 'name email avatar skills bio')
      .populate('job')
      .populate('interview')
      .lean();

    if (assessment) {
      return ApiResponse.success(res, { assessment });
    }

    // Fallback search in completed interviews
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId })
      .populate('user', 'name email avatar skills bio')
      .populate('feedback')
      .lean();

    if (!interview) return next(ApiError.notFound('Assessment report not found'));

    const score = interview.overallScore ?? interview.feedback?.overallScore ?? 0;
    const synthesized = {
      _id: interview._id,
      candidate: interview.user,
      candidateName: interview.user?.name || 'Candidate',
      job: { title: interview.jobRole || interview.title },
      assessmentType: `${interview.type.toUpperCase()} AI Evaluation`,
      score,
      passingScore: 70,
      passFailStatus: score >= 70 ? 'passed' : 'failed',
      completionDate: interview.completedAt || interview.updatedAt,
      summaryNotes: interview.feedback?.summary || 'Automated AI Interview Report',
      strengths: interview.feedback?.strengths || [],
      improvements: interview.feedback?.improvements || [],
      detailedCategoryScores: interview.feedback?.categoryScores || {},
    };

    ApiResponse.success(res, { assessment: synthesized });
  } catch (error) {
    next(error);
  }
};

// ─── COMPANY SETTINGS ─────────────────────────────────────
const getCompanySettings = async (req, res, next) => {
  try {
    const company = await Company.findById(req.companyId).populate('adminUser', 'name email role').lean();
    if (!company) return next(ApiError.notFound('Company not found'));
    ApiResponse.success(res, { company });
  } catch (error) {
    next(error);
  }
};

const updateCompanyProfile = async (req, res, next) => {
  try {
    const { name, contactEmail, logo, phone, website, address, description, preferredLanguage, timezone } = req.body;
    const company = await Company.findById(req.companyId);
    if (!company) return next(ApiError.notFound('Company not found'));

    if (name) company.name = name;
    if (contactEmail) company.contactEmail = contactEmail;
    if (logo !== undefined) company.logo = logo;
    if (phone !== undefined) company.phone = phone;
    if (website !== undefined) company.website = website;
    if (address !== undefined) company.address = address;
    if (description !== undefined) company.description = description;
    if (preferredLanguage !== undefined) company.preferredLanguage = preferredLanguage;
    if (timezone !== undefined) company.timezone = timezone;

    await company.save();
    ApiResponse.success(res, { company }, 'Company profile updated successfully');
  } catch (error) {
    next(error);
  }
};

const updateAccountSettings = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(ApiError.notFound('User not found'));

    if (currentPassword && newPassword) {
      const isMatch = await user.comparePassword(currentPassword);
      if (!isMatch) return next(ApiError.badRequest('Current password is incorrect'));
      user.password = newPassword;
      await user.save();
    }

    ApiResponse.success(res, null, 'Account settings updated successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  getCandidates,
  toggleShortlist,
  rejectCandidate,
  getInterviews,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  getInterviewResults,
  getAssessments,
  getAssessmentById,
  getCompanySettings,
  updateCompanyProfile,
  updateAccountSettings,
};
