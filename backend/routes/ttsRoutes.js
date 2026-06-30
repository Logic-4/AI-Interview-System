const express = require('express');
const { synthesize } = require('../controllers/ttsController');

const router = express.Router();

router.post('/', synthesize);

module.exports = router;
