const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

/**
 * Protect routes — verify JWT access token
 * Attaches user to req.user
 */
const protect = async (req, _res, next) => {
  try {
    let token;

    // Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(ApiError.unauthorized('Access denied. No token provided'));
    }

    // Verify token
    const decoded = verifyAccessToken(token);

    // Attach user to request (exclude password)
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user) {
      return next(ApiError.unauthorized('User no longer exists'));
    }

    req.user = user;
    next();
  } catch (error) {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
};

/**
 * Role-based authorization
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, _res, next) => {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Role '${req.user.role}' is not authorized to access this resource`));
    }

    next();
  };
};

module.exports = { protect, authorize };
