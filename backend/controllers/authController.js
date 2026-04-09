const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpiry } = require('../utils/tokenUtils');
const logger = require('../utils/logger');

/**
 * @desc    Register a new user
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(ApiError.badRequest('User with this email already exists'));
    }

    // Create user
    const user = await User.create({ name, email, password });

    // Generate tokens
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id });

    // Store refresh token
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: getTokenExpiry(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });
    await user.save();

    // Set refresh token in httpOnly cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

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
    const { email, password } = req.body;

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
    const refreshToken = generateRefreshToken({ id: user._id });

    // Clean up expired refresh tokens and add new one
    user.refreshTokens = user.refreshTokens.filter((t) => t.expiresAt > new Date());
    user.refreshTokens.push({
      token: refreshToken,
      expiresAt: getTokenExpiry(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });
    user.lastLogin = new Date();
    await user.save();

    // Set refresh token cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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
    const newRefreshToken = generateRefreshToken({ id: user._id });

    user.refreshTokens.push({
      token: newRefreshToken,
      expiresAt: getTokenExpiry(process.env.JWT_REFRESH_EXPIRES_IN || '7d'),
    });
    await user.save();

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

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

module.exports = {
  register,
  login,
  refreshToken: refreshTokenHandler,
  logout,
  getMe,
  validateSession,
};
