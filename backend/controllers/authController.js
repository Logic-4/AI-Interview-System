const crypto = require('crypto');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpiry, getExpiryMs } = require('../utils/tokenUtils');
const { sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const DEFAULT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REMEMBER_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || '30d';

const getRefreshDuration = (rememberMe) => (rememberMe ? REMEMBER_REFRESH_EXPIRES_IN : DEFAULT_REFRESH_EXPIRES_IN);

const getRefreshCookieOptions = (expiresIn) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: getExpiryMs(expiresIn),
});

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, rememberMe = false } = req.body;
    const shouldRemember = Boolean(rememberMe);
    const refreshExpiresIn = getRefreshDuration(shouldRemember);

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(ApiError.badRequest('User with this email already exists'));
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Generate tokens
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id }, refreshExpiresIn);

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: getTokenExpiry(refreshExpiresIn),
      rememberMe: shouldRemember,
    });
    await user.save();

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(refreshExpiresIn));

    logger.info(`New user registered: ${email}`);

    ApiResponse.created(res, {
      user: user.toSafeObject(),
      accessToken,
    }, 'Registration successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Login user
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    const shouldRemember = Boolean(rememberMe);
    const refreshExpiresIn = getRefreshDuration(shouldRemember);

    // Find user with password
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    // Generate tokens
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id }, refreshExpiresIn);

    // Clean up expired refresh tokens and add new one
    user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt > new Date());
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: getTokenExpiry(refreshExpiresIn),
      rememberMe: shouldRemember,
    });
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, getRefreshCookieOptions(refreshExpiresIn));

    logger.info(`User logged in: ${email}`);

    ApiResponse.success(res, {
      user: user.toSafeObject(),
      accessToken,
    }, 'Login successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Refresh access token
 * @route   POST /api/v1/auth/refresh-token
 * @access  Public (with refresh token)
 */
const refreshTokenHandler = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      return next(ApiError.unauthorized('No refresh token provided'));
    }

    // Verify token
    const decoded = verifyRefreshToken(token);

    // Find user and check token exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(ApiError.unauthorized('User not found'));
    }

    const storedToken = user.refreshTokens.find((t) => t.token === token && t.expiresAt > new Date());
    if (!storedToken) {
      // Token reuse detected — clear all tokens (security measure)
      user.refreshTokens = [];
      await user.save();
      return next(ApiError.unauthorized('Invalid refresh token. All sessions revoked.'));
    }

    // Rotate: remove old token, generate new pair
    user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);

    const newAccessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const shouldRemember = Boolean(storedToken.rememberMe);
    const refreshExpiresIn = getRefreshDuration(shouldRemember);
    const newRefreshToken = generateRefreshToken({ id: user._id }, refreshExpiresIn);

    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: getTokenExpiry(refreshExpiresIn),
      rememberMe: shouldRemember,
    });
    await user.save();

    res.cookie('refreshToken', newRefreshToken, getRefreshCookieOptions(refreshExpiresIn));

    ApiResponse.success(res, { accessToken: newAccessToken }, 'Token refreshed');
  } catch (error) {
    next(ApiError.unauthorized('Invalid refresh token'));
  }
};

/**
 * @desc    Logout user
 * @route   POST /api/v1/auth/logout
 * @access  Private
 */
const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      try {
        const decoded = verifyRefreshToken(token);
        const user = await User.findById(decoded.id);
        if (user) {
          user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
          await user.save();
          logger.info(`User logged out: ${user.email}`);
        }
      } catch {
        // Token invalid/expired — still clear the cookie below
      }
    }

    // Always clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });

    ApiResponse.success(res, null, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    ApiResponse.success(res, { user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Validate session from refresh token cookie
 * @route   GET /api/v1/auth/session
 * @access  Public
 */
const validateSession = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;
    const clearCookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    };

    if (!token) {
      return ApiResponse.success(res, { authenticated: false });
    }

    try {
      const decoded = verifyRefreshToken(token);
      const user = await User.findById(decoded.id).select('refreshTokens');

      if (!user) {
        res.clearCookie('refreshToken', clearCookieOptions);
        return ApiResponse.success(res, { authenticated: false });
      }

      const hasValidToken = user.refreshTokens.some(
        (stored) => stored.token === token && stored.expiresAt > new Date()
      );

      if (!hasValidToken) {
        res.clearCookie('refreshToken', clearCookieOptions);
        return ApiResponse.success(res, { authenticated: false });
      }

      return ApiResponse.success(res, { authenticated: true });
    } catch {
      res.clearCookie('refreshToken', clearCookieOptions);

      return ApiResponse.success(res, { authenticated: false });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Forgot password — send reset link
 * @route   POST /api/v1/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Always respond success to prevent email enumeration
    if (!user || user.provider !== 'local') {
      return ApiResponse.success(res, null, 'If an account exists with that email, a reset link has been sent.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Save hashed token + expiry (1 hour)
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send email (logs to console in dev)
    try {
      await sendPasswordResetEmail(user, resetToken);
      logger.info(`Password reset requested for: ${email}`);
    } catch (emailError) {
      // Clear token if email fails
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      logger.error(`Password reset email failed: ${emailError.message}`);
      return next(ApiError.internal('Failed to send reset email. Please try again.'));
    }

    ApiResponse.success(res, null, 'If an account exists with that email, a reset link has been sent.');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Reset password with token
 * @route   POST /api/v1/auth/reset-password/:token
 * @access  Public
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Hash the incoming token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return next(ApiError.badRequest('Invalid or expired reset token. Please request a new reset link.'));
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    // Invalidate all existing refresh tokens (security: force re-login)
    user.refreshTokens = [];
    await user.save();

    logger.info(`Password reset completed for: ${user.email}`);

    ApiResponse.success(res, null, 'Password has been reset successfully. Please sign in with your new password.');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  refreshToken: refreshTokenHandler,
  logout,
  getMe,
  validateSession,
  forgotPassword,
  resetPassword,
};
