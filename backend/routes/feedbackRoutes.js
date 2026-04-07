const express = require('express');
const router = express.Router();
const { getFeedback, generateFeedback, getUserProgress } = require('../controllers/feedbackController');
const { protect } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');

// All routes are protected
router.use(protect);

router.get('/progress', getUserProgress);
router.get('/:interviewId', getFeedback);
router.post('/:interviewId/generate', aiLimiter, generateFeedback);

module.exports = router;
