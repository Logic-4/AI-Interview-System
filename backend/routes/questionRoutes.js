const express = require('express');
const router = express.Router();
const {
  getQuestions,
  getQuestion,
} = require('../controllers/questionController');
const { listQuestionsValidator } = require('../validators/questionValidator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Read — available to all authenticated users
router.get('/', listQuestionsValidator, validate, getQuestions);
router.get('/:id', getQuestion);

// Write — admin/interviewer only

// AI generation — admin only

module.exports = router;
