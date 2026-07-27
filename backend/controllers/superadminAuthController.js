const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { generateAccessToken, generateRefreshToken, getTokenExpiry, getExpiryMs } = require('../utils/tokenUtils');

const DEFAULT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
const REMEMBER_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_REMEMBER_EXPIRES_IN || '30d';

const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe = false } = req.body;
    const user = await User.findOne({ email }).select('+password');

    // Deliberately keep this message identical for invalid credentials and roles.
    if (!user || user.role !== 'superadmin' || user.accountStatus !== 'active' || !(await user.comparePassword(password))) {
      return next(ApiError.unauthorized('Invalid email or password'));
    }

    const expiresIn = rememberMe ? REMEMBER_REFRESH_EXPIRES_IN : DEFAULT_REFRESH_EXPIRES_IN;
    const accessToken = generateAccessToken({ id: user._id, email: user.email, role: user.role });
    const refreshToken = generateRefreshToken({ id: user._id }, expiresIn);
    user.refreshTokens = user.refreshTokens.filter((item) => item.expiresAt > new Date());
    user.refreshTokens.push({ token: refreshToken, expiresAt: getTokenExpiry(expiresIn), rememberMe: Boolean(rememberMe) });
    user.lastLogin = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      ...(rememberMe ? { maxAge: getExpiryMs(expiresIn) } : {}),
    });

    ApiResponse.success(res, { user: user.toSafeObject(), accessToken, refreshToken }, 'Superadmin login successful');
  } catch (error) {
    next(error);
  }
};

module.exports = { login };
