const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Validation middleware runner
 * Runs express-validator chains and returns 400 with error details
 */
const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const extractedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
      value: err.value,
    }));

    return next(ApiError.badRequest('Validation failed', extractedErrors));
  }

  next();
};

module.exports = validate;
