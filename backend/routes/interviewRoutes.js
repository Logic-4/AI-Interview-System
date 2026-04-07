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
router.put('/:interviewId/questions/:questionId/answer', upload.single('audio'), submitAnswerValidator, validate, submitAnswer);
router.put('/:id/complete', completeInterview);

module.exports = router;
