const express = require('express');
const router = express.Router();
const {
  createQuestion,
  getQuestions,
  getQuestion,
  updateQuestion,
  deleteQuestion,
  generateQuestions,
} = require('../controllers/questionController');
const { createQuestionValidator, generateQuestionsValidator, listQuestionsValidator } = require('../validators/questionValidator');
const validate = require('../middleware/validate');
const { protect, authorize } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

// All routes are protected
router.use(protect);

// Read — available to all authenticated users
router.get('/', listQuestionsValidator, validate, getQuestions);
router.get('/:id', getQuestion);

// Write — admin/interviewer only
router.post('/', authorize('admin', 'interviewer'), createQuestionValidator, validate, createQuestion);
router.put('/:id', authorize('admin', 'interviewer'), updateQuestion);
router.delete('/:id', authorize('admin', 'interviewer'), deleteQuestion);

// AI generation — admin only
router.post('/generate', authorize('admin'), aiLimiter, generateQuestionsValidator, validate, generateQuestions);

module.exports = router;
