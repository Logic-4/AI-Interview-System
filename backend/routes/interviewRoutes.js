const express = require('express');
const router = express.Router();
const {
  createInterview,
  getInterviews,
  getInterview,
  startInterview,
  submitAnswer,
  completeInterview,
  deleteInterview,
  retryEvaluate,
  resetInterview,
} = require('../controllers/interviewController');
const { createInterviewValidator, submitAnswerValidator, listInterviewsValidator } = require('../validators/interviewValidator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

// CRUD
router.post('/', aiLimiter, createInterviewValidator, validate, createInterview);
router.get('/', listInterviewsValidator, validate, getInterviews);
router.get('/:id', getInterview);
router.delete('/:id', deleteInterview);

// Interview lifecycle
router.put('/:id/start', startInterview);
router.put('/:interviewId/questions/:questionId/answer', aiLimiter, upload.single('audio'), submitAnswerValidator, validate, submitAnswer);
router.put('/:id/complete', completeInterview);
router.put('/:id/reset', resetInterview);

// Practice loop — retry a question after feedback (Step 7)
router.post('/:interviewId/questions/:questionId/retry', aiLimiter, retryEvaluate);

module.exports = router;
