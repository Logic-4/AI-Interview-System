const rateLimit = require('express-rate-limit');

const isDevelopment = process.env.NODE_ENV === 'development';
const devBypassLimiter = (_req, _res, next) => next();

const createLimiter = (options) => {
  if (isDevelopment) return devBypassLimiter;
  return rateLimit(options);
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
const generalLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'GET' && /^\/api\/v1\/interviews\/[^/]+\/progress$/.test(req.originalUrl.split('?')[0]),
});

/**
 * Auth-specific rate limiter (stricter)
 * 20 requests per 15 minutes per IP
 */
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * AI endpoint rate limiter (expensive calls)
 * 30 requests per 15 minutes per IP
 */
const aiLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    statusCode: 429,
    message: 'Too many AI requests. Please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { generalLimiter, authLimiter, aiLimiter };
