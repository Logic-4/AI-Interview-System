const express = require('express');
const router = express.Router();
const { uploadInterviewRecording, uploadAudioAnswer, uploadUserAvatar } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

router.post('/recording/:interviewId', upload.single('recording'), uploadInterviewRecording);
router.post('/audio/:questionId', upload.single('audio'), uploadAudioAnswer);
router.post('/avatar', upload.single('avatar'), uploadUserAvatar);

module.exports = router;
