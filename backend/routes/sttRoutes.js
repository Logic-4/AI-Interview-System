const express = require('express');
const { protect } = require('../middleware/auth');
const { transcribe, upload } = require('../controllers/sttController');

const router = express.Router();

// All STT endpoints require a valid session
router.use(protect);

/**
 * POST /api/v1/stt/transcribe
 *
 * Accepts a multipart audio file (field name: "audio") and returns a JSON
 * transcript produced by the local Somali ASR model.
 *
 * Body:   multipart/form-data  { audio: <file> }
 * Returns: { success: true, transcript: "..." }
 */
router.post('/transcribe', upload.single('audio'), transcribe);

module.exports = router;
