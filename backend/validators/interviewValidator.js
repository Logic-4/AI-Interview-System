const { body, param, query } = require('express-validator');

const createInterviewValidator = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ max: 200 })
    .withMessage('Title cannot exceed 200 characters'),

  body('type')
    .notEmpty()
    .withMessage('Interview type is required')
    .isIn(['technical', 'behavioral', 'system-design', 'hr', 'mixed'])
    .withMessage('Type must be technical, behavioral, system-design, hr, or mixed'),

  body('difficulty')
    .notEmpty()
    .withMessage('Difficulty is required')
    .isIn(['junior', 'mid', 'senior', 'lead'])
    .withMessage('Difficulty must be junior, mid, senior, or lead'),

  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .isIn(['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'])
    .withMessage('Invalid domain'),

  body('jobRole')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Job role cannot exceed 200 characters'),

  body('focusSkills')
    .optional()
    .isArray({ max: 20 })
    .withMessage('Focus skills must be an array with max 20 items'),

  body('focusSkills.*')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Each skill cannot exceed 100 characters'),

  body('jobDescription')
    .optional()
    .isString()
    .withMessage('Job description must be a string'),

  body('duration')
    .optional()
    .isInt({ min: 5, max: 120 })
    .withMessage('Duration must be between 5 and 120 minutes'),

  body('language')
    .optional()
    .isIn(['english', 'somali'])
    .withMessage('Language must be english or somali'),

  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
];

const submitAnswerValidator = [
  param('interviewId')
    .isMongoId()
    .withMessage('Invalid interview ID'),

  param('questionId')
    .isMongoId()
    .withMessage('Invalid question ID'),

  body('userAnswer')
    .optional()
    .isString()
    .withMessage('Answer must be a string'),

  body('timeSpent')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Time spent must be a positive integer'),

  body('activePromptText')
    .optional()
    .isString()
    .withMessage('Active prompt text must be a string'),
];

const listInterviewsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),

  query('status')
    .optional()
    .isIn(['scheduled', 'in-progress', 'completed', 'cancelled'])
    .withMessage('Invalid status filter'),

  query('type')
    .optional()
    .isIn(['technical', 'behavioral', 'system-design', 'hr', 'mixed'])
    .withMessage('Invalid type filter'),

  query('search')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Search must be between 1 and 100 characters'),
];

module.exports = {
  createInterviewValidator,
  submitAnswerValidator,
  listInterviewsValidator,
};
