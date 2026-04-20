const jwt = require('jsonwebtoken');
const units = { s: 1000, m: 60000, h: 3600000, d: 86400000 };

/**
 * Generate an access token for a user
 * @param {Object} payload - { id, email, role }
 * @returns {string} JWT access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  });
};

/**
 * Generate a refresh token for a user
 * @param {Object} payload - { id }
 * @returns {string} JWT refresh token
 */
const generateRefreshToken = (payload, expiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d') => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
};

/**
 * Verify an access token
 * @param {string} token
 * @returns {Object} decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET);
};

/**
 * Verify a refresh token
 * @param {string} token
 * @returns {Object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Get token expiry as a Date object
 * @param {string} expiresIn - e.g. '7d', '15m'
 * @returns {Date}
 */
const getTokenExpiry = (expiresIn) => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiresIn}`);
  return new Date(Date.now() + parseInt(match[1]) * units[match[2]]);
};

/**
 * Get expiry duration in milliseconds
 * @param {string} expiresIn - e.g. '7d', '15m'
 * @returns {number}
 */
const getExpiryMs = (expiresIn) => {
  const match = expiresIn.match(/^(\d+)([smhd])$/);
  if (!match) throw new Error(`Invalid expiry format: ${expiresIn}`);
  return parseInt(match[1], 10) * units[match[2]];
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  getTokenExpiry,
  getExpiryMs,
};
