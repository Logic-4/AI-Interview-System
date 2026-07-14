const express = require('express');
const router = express.Router();
const { getQuestions, getQuestion } = require('../controllers/questionController');
const { listQuestionsValidator } = require('../validators/questionValidator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

router.use(protect);

// Read-only question library for authenticated users.
router.get('/', listQuestionsValidator, validate, getQuestions);
router.get('/:id', getQuestion);

module.exports = router;
