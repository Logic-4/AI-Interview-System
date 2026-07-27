const express = require('express');
const { login } = require('../controllers/superadminAuthController');
const { loginValidator } = require('../validators/authValidator');
const validate = require('../middleware/validate');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();
router.post('/login', authLimiter, loginValidator, validate, login);
module.exports = router;
