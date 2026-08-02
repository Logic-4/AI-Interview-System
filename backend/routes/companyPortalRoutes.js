const express = require('express');
const { protect } = require('../middleware/auth');
const { requireCompanyAccess } = require('../middleware/companyAuthMiddleware');
const validate = require('../middleware/validate');
const { jobValidationRules } = require('../validators/jobValidator');
const controller = require('../controllers/companyPortalController');

const router = express.Router();

// Apply auth protection & company ownership check to all routes
router.use(protect, requireCompanyAccess);

// ─── Dashboard ───
router.get('/dashboard', controller.getDashboard);

// ─── Job Postings ───
router.get('/jobs', controller.getJobs);
router.get('/jobs/:id', controller.getJobById);
router.post('/jobs', jobValidationRules, validate, controller.createJob);
router.put('/jobs/:id', jobValidationRules, validate, controller.updateJob);
router.delete('/jobs/:id', controller.deleteJob);

// ─── Applications ───
router.get('/applications', controller.getApplications);
router.get('/applications/:id', controller.getApplicationById);
router.delete('/applications/:id', controller.deleteApplication);
router.patch('/applications/:id/status', controller.updateApplicationStatus);
router.patch('/applications/:id/approve', controller.approveApplication);

// ─── Candidates & Shortlist ───
router.get('/candidates', controller.getCandidates);
router.patch('/candidates/:id/shortlist', controller.toggleShortlist);
router.patch('/candidates/:id/reject', controller.rejectCandidate);

// ─── Interviews ───
router.get('/interviews', controller.getInterviews);
router.post('/interviews/schedule', controller.scheduleInterview);
router.patch('/interviews/:id/reschedule', controller.rescheduleInterview);
router.patch('/interviews/:id/cancel', controller.cancelInterview);
router.delete('/interviews/:id', controller.deleteInterview);
router.get('/interviews/:id/results', controller.getInterviewResults);

// ─── Assessments ───
router.get('/assessments', controller.getAssessments);
router.get('/assessments/:id', controller.getAssessmentById);

// ─── Security Events (Identity Verification) ───
router.get('/security-events', controller.getSecurityEvents);
router.patch('/security-events/:id/review', controller.reviewSecurityEvent);

// ─── Settings ───
router.get('/settings', controller.getCompanySettings);
router.put('/settings/profile', controller.updateCompanyProfile);
router.put('/settings/account', controller.updateAccountSettings);

module.exports = router;
