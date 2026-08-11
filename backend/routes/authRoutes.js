const express = require('express');
const router = express.Router();
const { login, refreshToken, logout, getMe, validateSession, forgotPassword, resetPassword, redeemInterviewLink } = require('../controllers/authController');
const { googleRedirect, googleCallback } = require('../controllers/oauthController');
const { loginValidator, refreshTokenValidator, forgotPasswordValidator, resetPasswordValidator } = require('../validators/authValidator');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes (with auth rate limiter)
router.post('/login', authLimiter, loginValidator, validate, login);
router.post('/refresh-token', authLimiter, refreshTokenValidator, validate, refreshToken);
router.get('/session', validateSession);
router.post('/forgot-password', authLimiter, forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password/:token', authLimiter, resetPasswordValidator, validate, resetPassword);

// Interview magic link — auto-authenticate candidate from email CTA
router.get('/interview-link', authLimiter, redeemInterviewLink);

// Google OAuth
router.get('/google', googleRedirect);
router.get('/google/callback', googleCallback);

// Logout (public — clears cookie even without valid token)
router.post('/logout', logout);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
