const express = require('express');
const { protect } = require('../middleware/auth');
const { synthesize } = require('../controllers/ttsController');

const router = express.Router();

router.use(protect);
router.post('/', synthesize);

module.exports = router;
