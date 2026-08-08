const Job = require('../models/Job');
const Application = require('../models/Application');
const Candidate = require('../models/User');
const Interview = require('../models/Interview');
const Assessment = require('../models/Assessment');
const Company = require('../models/Company');
const User = require('../models/User');
const VerificationEvent = require('../models/VerificationEvent');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { buildInterviewPayload } = require('../services/promptPayloadService');
const {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendInterviewScheduledEmail,
  sendInterviewRescheduledEmail,
  sendInterviewCancelledEmail,
} = require('../services/emailService');
const { generateInterviewLinkToken } = require('../utils/tokenUtils');
const { deleteBlobUrls } = require('../services/blobService');
const { startInterviewWarmup } = require('../services/interviewWarmupService');
const { ensureQuestionGeneration } = require('./interviewController');
const { parseScheduledAt } = require('../utils/scheduledTime');
const logger = require('../utils/logger');

const normalizePagination = (value, fallback, max) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), max);

// Notification emails must never break the underlying action (approval,
// rejection, scheduling) if the mail provider is unreachable or unconfigured.
function notifyEmail(sendFn, ...args) {
  Promise.resolve()
    .then(() => sendFn(...args))
    .catch((error) => logger.warn(`Notification email failed: ${error.message}`));
}

async function deleteCompanyInterviewRecord(interview) {
  const [audioUrls, verificationEvents] = await Promise.all([
    Question.find({ interview: interview._id }).distinct('audioUrl'),
    VerificationEvent.find({ interview: interview._id }).select('liveFrameUrl referenceImageUrl').lean(),
  ]);
  const chunkUrls = (interview.recordingChunks || []).map((chunk) => chunk.url);
  const verificationUrls = verificationEvents.flatMap((event) => [event.liveFrameUrl, event.referenceImageUrl]);

  await deleteBlobUrls([interview.recordingUrl, ...chunkUrls, ...audioUrls, ...verificationUrls]);
  await Promise.all([
    Question.deleteMany({ interview: interview._id }),
    Feedback.deleteMany({ interview: interview._id }),
    Assessment.deleteMany({ interview: interview._id }),
    VerificationEvent.deleteMany({ interview: interview._id }),
    Application.updateMany(
      { company: interview.company, interview: interview._id },
      { $set: { interview: null, interviewStatus: 'not_scheduled' } }
    ),
  ]);
  await Interview.findByIdAndDelete(interview._id);
}

async function approveApplicationRecord(application, reviewerId) {
  application.approvalStatus = 'approved';
  application.approvedAt = new Date();
  application.approvedBy = reviewerId;
  application.rejectionReason = '';
  if (application.status === 'applied') application.status = 'under_review';
  await application.save();
}

async function rejectApplicationRecord(application, reviewerId, reason = '') {
  application.approvalStatus = 'rejected';
  application.status = 'rejected';
  application.isShortlisted = false;
  application.rejectionReason = String(reason || '').slice(0, 1000);
  application.rejectedAt = new Date();
  application.rejectedBy = reviewerId;
  await application.save();
}

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
      unreviewedSecurityEvents,
      recentSecurityEvents,
    ] = await Promise.all([
      Job.countDocuments({ company: companyId }),
      Job.countDocuments({ company: companyId, status: 'published' }),
      Job.countDocuments({ company: companyId, status: 'draft' }),
      Application.countDocuments({ company: companyId }),
      Application.countDocuments({ company: companyId, status: 'interviewed' }),
      Application.countDocuments({ company: companyId, isShortlisted: true }),
      Interview.countDocuments({ company: companyId, status: 'scheduled' }),

      Application.find({ company: companyId })
        .populate('job', 'title')
        .populate('candidate', 'name email avatar')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      Interview.find({ company: companyId, status: 'scheduled' })
        .populate('user', 'name email avatar')
        .sort({ scheduledAt: 1 })
        .limit(5)
        .lean(),

      VerificationEvent.countDocuments({ company: companyId, outcome: { $ne: 'passed' }, reviewed: false }),

      VerificationEvent.find({ company: companyId, outcome: { $ne: 'passed' } })
        .populate('interview', 'title jobRole')
        .sort({ createdAt: -1 })
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
        subtitle: `Location: ${j.location}`,
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
        unreviewedSecurityEvents,
      },
      recentApplications,
      upcomingInterviews,
      recentSecurityEvents,
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
    const { search = '', status = '' } = req.query;

    const filter = { company: req.companyId };
    if (status) filter.status = status;
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
        .populate('job', 'title experienceLevel')
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

const deleteApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));

    if (application.interview) {
      const interview = await Interview.findOne({ _id: application.interview, company: req.companyId });
      if (interview) await deleteCompanyInterviewRecord(interview);
    }

    await application.deleteOne();
    ApiResponse.success(res, null, 'Application deleted successfully');
  } catch (error) {
    next(error);
  }
};

const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status, isShortlisted, reason } = req.body;
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));

    // Rejections always go through the shared helper so the audit fields and
    // the candidate notification email stay consistent regardless of which
    // screen triggered the status change.
    if (status === 'rejected' && application.status !== 'rejected') {
      await rejectApplicationRecord(application, req.user._id, reason);
      const job = await Job.findById(application.job).select('title').lean();
      notifyEmail(
        sendApplicationRejectedEmail,
        { name: application.candidateName, email: application.candidateEmail },
        job,
        req.company,
        application.rejectionReason
      );
      return ApiResponse.success(res, { application }, 'Application status updated');
    }

    if (status !== undefined) application.status = status;
    if (isShortlisted !== undefined) application.isShortlisted = isShortlisted;

    await application.save();
    ApiResponse.success(res, { application }, 'Application status updated');
  } catch (error) {
    next(error);
  }
};

const approveApplication = async (req, res, next) => {
  try {
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));
    if (application.status === 'rejected') {
      return next(ApiError.badRequest('Cannot approve an application that has already been rejected'));
    }

    await approveApplicationRecord(application, req.user._id);

    const job = await Job.findById(application.job).select('title').lean();
    notifyEmail(
      sendApplicationApprovedEmail,
      { name: application.candidateName, email: application.candidateEmail },
      job,
      req.company
    );

    ApiResponse.success(res, { application }, 'Application approved');
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

    const filter = { company: req.companyId, isShortlisted: { $ne: true } };
    if (status) filter.status = status;
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ candidateName: pattern }, { candidateEmail: pattern }];
    }

    const applications = await Application.find(filter)
      .populate('job', 'title')
      .populate('candidate', 'name email avatar experienceLevel skills')
      .populate('interview', 'overallScore status')
      .sort({ createdAt: -1 })
      .lean();

    let candidates = applications.map((app) => ({
      _id: app._id,
      candidateId: app.candidate?._id || app._id,
      name: app.candidateName,
      email: app.candidateEmail,
      phone: app.candidatePhone || '',
      appliedPosition: app.job?.title || 'N/A',
      jobId: app.job?._id,
      interviewId: app.interview?._id ?? app.interview ?? null,
      experienceLevel: app.candidate?.experienceLevel || 'Mid',
      interviewScore: app.overallScore ?? app.interview?.overallScore ?? null,
      status: app.status,
      isShortlisted: app.isShortlisted,
      approvalStatus: app.approvalStatus || 'pending',
      rejectionReason: app.rejectionReason || '',
      appliedDate: app.appliedDate,
      avatar: app.profilePhotoUrl || app.candidate?.avatar || '',
      profilePhotoUrl: app.profilePhotoUrl || '',
      skills: app.candidate?.skills || [],
      resumeUrl: app.resumeUrl || '',
      resumeText: app.resumeText || '',
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
    } else if (!application.isShortlisted && application.status === 'shortlisted') {
      application.status = 'under_review';
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
    const { reason } = req.body;
    const application = await Application.findOne({ _id: req.params.id, company: req.companyId });
    if (!application) return next(ApiError.notFound('Application not found'));

    await rejectApplicationRecord(application, req.user._id, reason);

    const job = await Job.findById(application.job).select('title').lean();
    notifyEmail(
      sendApplicationRejectedEmail,
      { name: application.candidateName, email: application.candidateEmail },
      job,
      req.company,
      application.rejectionReason
    );

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
    const { applicationId, jobRole, type, difficulty, domain, language, duration, scheduledAt } = req.body;
    const scheduledDate = scheduledAt ? parseScheduledAt(scheduledAt, req.company?.timezone) : new Date();
    if (!scheduledDate) return next(ApiError.badRequest('Scheduled date must be a valid date and time'));
    let candidateId = req.body.candidateId;

    let candidate = null;
    let application = null;
    let job = null;

    if (applicationId) {
      application = await Application.findOne({ _id: applicationId, company: req.companyId });
      if (!application) {
        return next(ApiError.notFound('Application not found for this company'));
      }
      if (application.approvalStatus !== 'approved') {
        return next(ApiError.badRequest('Candidate must be approved before scheduling an interview'));
      }
      candidateId = candidateId || application.candidate;
      job = await Job.findById(application.job);
    }

    if (!candidateId && !application) return next(ApiError.badRequest('Candidate is required for scheduling an interview'));

    if (candidateId) {
      candidate = await User.findById(candidateId);
    }

    if (!candidate && application?.candidateEmail) {
      candidate = await User.findOne({ email: application.candidateEmail.trim().toLowerCase() });
    }

    if (!candidate && application) {
      candidate = await User.create({
        name: application.candidateName || 'Candidate',
        email: application.candidateEmail.trim().toLowerCase(),
        role: 'candidate',
      });
    }

    if (!candidate) return next(ApiError.notFound('Candidate user not found'));

    if (application && String(application.candidate) !== String(candidate._id)) {
      application.candidate = candidate._id;
      await application.save();
    }

    // Pull the interview configuration and parsed resume from the Job +
    // Application when scheduling from an application; req.body can still
    // override individual fields (e.g. manual, non-application scheduling).
    const jobPayload = job ? buildInterviewPayload(job, application) : null;

    const resolvedJobRole = jobRole || jobPayload?.jobRole || 'Candidate';

    const interview = await Interview.create({
      user: candidate._id,
      company: req.companyId,
      title: `${resolvedJobRole} Interview - ${candidate.name}`,
      type: type || jobPayload?.type || 'mixed',
      difficulty: difficulty || jobPayload?.difficulty || 'mid',
      domain: domain || jobPayload?.domain || 'technology',
      language: (language || jobPayload?.language || 'english').toLowerCase(),
      jobRole: resolvedJobRole,
      jobDescription: jobPayload?.jobDescription || '',
      resumeText: jobPayload?.resumeText || '',
      focusSkills: jobPayload?.focusSkills || [],
      duration: duration || jobPayload?.duration || 30,
      expectedQuestionCount: jobPayload?.numberOfQuestions || undefined,
      scheduledAt: scheduledDate,
      status: 'scheduled',
    });

    if (application) {
      application.interview = interview._id;
      application.interviewStatus = 'scheduled';
      application.status = 'interview_scheduled';
      await application.save();
    }

    // Kick RunPod out of scale-to-zero and start question generation now, so
    // the candidate is not the one to eat the ~30-90s cold start when they
    // click the invite link. Both are fire-and-forget — a warmup or gen
    // failure here must not block scheduling or the email.
    try {
      startInterviewWarmup({
        requestId: req.requestId || `schedule-warmup-${interview._id}`,
        language: interview.language,
      });
    } catch (warmErr) {
      logger.warn(`[scheduleInterview] warmup kick failed: ${warmErr.message}`);
    }
    ensureQuestionGeneration(interview, {
      requestId: req.requestId || `schedule-pregen-${interview._id}`,
      source: 'schedule',
      jobRole: interview.jobRole,
      jobDescription: interview.jobDescription,
      resumeText: interview.resumeText,
      focusSkills: interview.focusSkills,
      language: interview.language,
      candidateName: candidate.name,
    }).catch((genErr) => logger.warn(`[scheduleInterview] pre-gen failed: ${genErr.message}`));

    const scheduledMagicToken = generateInterviewLinkToken(candidate._id, interview._id);
    notifyEmail(
      sendInterviewScheduledEmail,
      { name: candidate.name, email: candidate.email },
      interview,
      job,
      req.company,
      scheduledMagicToken
    );

    ApiResponse.created(res, { interview }, 'Interview scheduled successfully');
  } catch (error) {
    next(error);
  }
};

const rescheduleInterview = async (req, res, next) => {
  try {
    const { scheduledAt } = req.body;
    const scheduledDate = parseScheduledAt(scheduledAt, req.company?.timezone);
    if (!scheduledDate) return next(ApiError.badRequest('Scheduled date must be a valid date and time'));
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId }).populate(
      'user',
      'name email'
    );
    if (!interview) return next(ApiError.notFound('Interview not found'));

    interview.scheduledAt = scheduledDate;
    interview.status = 'scheduled';
    await interview.save();

    const rescheduledMagicToken = generateInterviewLinkToken(interview.user._id, interview._id);
    notifyEmail(
      sendInterviewRescheduledEmail,
      { name: interview.user?.name, email: interview.user?.email },
      interview,
      null,
      req.company,
      rescheduledMagicToken
    );

    ApiResponse.success(res, { interview }, 'Interview rescheduled successfully');
  } catch (error) {
    next(error);
  }
};

const cancelInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId }).populate(
      'user',
      'name email'
    );
    if (!interview) return next(ApiError.notFound('Interview not found'));

    interview.status = 'cancelled';
    await interview.save();

    notifyEmail(
      sendInterviewCancelledEmail,
      { name: interview.user?.name, email: interview.user?.email },
      interview,
      null,
      req.company
    );

    ApiResponse.success(res, { interview }, 'Interview cancelled successfully');
  } catch (error) {
    next(error);
  }
};

const deleteInterview = async (req, res, next) => {
  try {
    const interview = await Interview.findOne({ _id: req.params.id, company: req.companyId });
    if (!interview) return next(ApiError.notFound('Interview not found'));
    if (interview.status === 'in-progress') {
      return next(ApiError.badRequest('An interview in progress cannot be deleted'));
    }

    await deleteCompanyInterviewRecord(interview);
    ApiResponse.success(res, null, 'Interview deleted successfully');
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
        .populate('job', 'title')
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

      // Batch-fetch linked applications to resolve per-job passing thresholds
      const interviewIds = completedInterviews.map((inv) => inv._id);
      const linkedApps = await Application.find(
        { interview: { $in: interviewIds }, company: req.companyId }
      ).populate('job', 'passingScoreThreshold title').lean();
      const thresholdMap = Object.fromEntries(
        linkedApps.map((app) => [String(app.interview), app.job?.passingScoreThreshold ?? 70])
      );
      const jobTitleMap = Object.fromEntries(
        linkedApps.map((app) => [String(app.interview), app.job?.title])
      );

      const synthesizedAssessments = completedInterviews.map((inv) => {
        const rawScore = inv.overallScore ?? inv.feedback?.overallScore ?? null;
        const passingScore = thresholdMap[String(inv._id)] ?? 70;
        const flaggedForReview = Boolean(inv.proctoring?.flaggedForReview);
        const completionFlag = inv.completionFlag || 'ok';
        let passFailStatus;
        if (rawScore == null || completionFlag === 'no_valid_evaluations') {
          passFailStatus = 'pending_review';
        } else if (flaggedForReview) {
          passFailStatus = 'requires_review';
        } else {
          passFailStatus = rawScore >= passingScore ? 'passed' : 'failed';
        }
        return {
          _id: inv._id,
          candidate: inv.user,
          candidateName: inv.user?.name || 'Candidate',
          job: { title: jobTitleMap[String(inv._id)] || inv.jobRole || inv.title || 'Technical Assessment' },
          assessmentType: `${inv.type.toUpperCase()} AI Evaluation`,
          score: rawScore,
          passingScore,
          passFailStatus,
          completionFlag,
          completionDate: inv.completedAt || inv.updatedAt,
          summaryNotes: inv.feedback?.summary || 'Completed automated AI Mock Interview evaluation.',
          strengths: inv.feedback?.strengths || [],
          improvements: inv.feedback?.improvements || [],
          integrityScore: inv.proctoring?.integrityScore ?? 100,
          flaggedForReview,
          proctoringStrikes: inv.proctoring?.strikes ?? 0,
        };
      });

      const filtered = passFailStatus
        ? synthesizedAssessments.filter((a) => a.passFailStatus === passFailStatus)
        : synthesizedAssessments;

      return ApiResponse.success(res, {
        assessments: filtered.slice((page - 1) * limit, page * limit),
        pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) || 1 },
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
      .populate({ path: 'interview', populate: ['questions', 'feedback'] })
      .lean();

    if (assessment) {
      return ApiResponse.success(res, { assessment });
    }

    // Fallback: synthesize from completed interview, fetching linked job for threshold
    const [interview, linkedApp] = await Promise.all([
      Interview.findOne({ _id: req.params.id, company: req.companyId })
        .populate('user', 'name email avatar skills bio')
        .populate('feedback')
        .populate('questions')
        .lean(),
      Application.findOne({ interview: req.params.id, company: req.companyId })
        .populate('job', 'passingScoreThreshold title')
        .lean(),
    ]);

    if (!interview) return next(ApiError.notFound('Assessment report not found'));

    const rawScore = interview.overallScore ?? interview.feedback?.overallScore ?? null;
    const passingScore = linkedApp?.job?.passingScoreThreshold ?? 70;
    const flaggedForReview = Boolean(interview.proctoring?.flaggedForReview);
    const completionFlag = interview.completionFlag || 'ok';
    let passFailStatus;
    if (rawScore == null || completionFlag === 'no_valid_evaluations') {
      passFailStatus = 'pending_review';
    } else if (flaggedForReview) {
      passFailStatus = 'requires_review';
    } else {
      passFailStatus = rawScore >= passingScore ? 'passed' : 'failed';
    }

    const synthesized = {
      _id: interview._id,
      candidate: interview.user,
      candidateName: interview.user?.name || 'Candidate',
      job: linkedApp?.job || { title: interview.jobRole || interview.title },
      assessmentType: `${interview.type.toUpperCase()} AI Evaluation`,
      score: rawScore,
      passingScore,
      passFailStatus,
      completionFlag,
      completionDate: interview.completedAt || interview.updatedAt,
      summaryNotes: interview.feedback?.summary || 'Automated AI Interview Report',
      detailedFeedback: interview.feedback?.detailedFeedback || '',
      strengths: interview.feedback?.strengths || [],
      improvements: interview.feedback?.improvements || [],
      categoryScores: interview.feedback?.categories || null,
      integrityScore: interview.proctoring?.integrityScore ?? 100,
      flaggedForReview,
      proctoringStrikes: interview.proctoring?.strikes ?? 0,
      identityVerification: interview.identityVerification || null,
      proctoringViolations: interview.proctoring?.violations || [],
      questionEvaluations: (interview.questions || [])
        .sort((a, b) => a.order - b.order)
        .map((q) => ({
          order: q.order,
          text: q.text,
          category: q.category,
          score: q.score,
          evaluationStatus: q.evaluationStatus,
          aiFeedback: q.aiFeedback || '',
          userAnswer: q.userAnswer || '',
          audioUrl: q.audioUrl || '',
        })),
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

// ─── SECURITY EVENTS (Identity Verification) ────────────
const getSecurityEvents = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 1000);
    const limit = normalizePagination(req.query.limit, 20, 100);
    const { outcome = '', reviewed = '' } = req.query;

    const filter = { company: req.companyId };
    if (outcome) filter.outcome = outcome;
    if (reviewed === 'true') filter.reviewed = true;
    if (reviewed === 'false') filter.reviewed = false;

    const [events, total] = await Promise.all([
      VerificationEvent.find(filter)
        .populate('interview', 'title jobRole scheduledAt')
        .populate('reviewedBy', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      VerificationEvent.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, { events }, { page, limit, total, totalPages: Math.ceil(total / limit) || 1 });
  } catch (error) {
    next(error);
  }
};

const reviewSecurityEvent = async (req, res, next) => {
  try {
    const event = await VerificationEvent.findOne({ _id: req.params.id, company: req.companyId });
    if (!event) return next(ApiError.notFound('Security event not found'));

    event.reviewed = true;
    event.reviewedAt = new Date();
    event.reviewedBy = req.user._id;
    await event.save();

    ApiResponse.success(res, { event }, 'Security event marked as reviewed');
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
  deleteApplication,
  updateApplicationStatus,
  approveApplication,
  getCandidates,
  toggleShortlist,
  rejectCandidate,
  getInterviews,
  scheduleInterview,
  rescheduleInterview,
  cancelInterview,
  deleteInterview,
  getInterviewResults,
  getAssessments,
  getAssessmentById,
  getCompanySettings,
  updateCompanyProfile,
  updateAccountSettings,
  getSecurityEvents,
  reviewSecurityEvent,
};
