const { body } = require('express-validator');

const jobValidationRules = [
  body('title')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Job title cannot be empty')
    .isLength({ max: 150 })
    .withMessage('Job title cannot exceed 150 characters'),

  body('department')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Department cannot be empty'),

  body('employmentType')
    .optional()
    .isIn(['full-time', 'part-time', 'contract', 'internship'])
    .withMessage('Employment type must be full-time, part-time, contract, or internship'),

  body('workplaceType')
    .optional()
    .isIn(['on-site', 'remote', 'hybrid'])
    .withMessage('Workplace type must be on-site, remote, or hybrid'),

  body('location')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Location cannot be empty'),

  body('numberOfHiresNeeded')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Number of hires needed must be at least 1'),

  body('description')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Job description cannot be empty'),

  body('experienceLevel')
    .optional()
    .isIn(['junior', 'mid', 'senior', 'lead'])
    .withMessage('Experience level must be junior, mid, senior, or lead'),

  body('status')
    .optional()
    .isIn(['draft', 'published', 'paused', 'closed'])
    .withMessage('Status must be draft, published, paused, or closed'),

  body('interviewLanguage')
    .optional()
    .isIn(['English', 'Somali'])
    .withMessage('Interview language must be English or Somali'),

  body('interviewType')
    .optional()
    .isIn(['technical', 'behavioral', 'hr', 'system-design', 'mixed'])
    .withMessage('Interview type must be technical, behavioral, hr, system-design, or mixed'),

  body('difficulty')
    .optional()
    .isIn(['junior', 'mid', 'senior', 'lead'])
    .withMessage('Difficulty must be junior, mid, senior, or lead'),

  body('durationMinutes')
    .optional()
    .isInt({ min: 5, max: 120 })
    .withMessage('Duration must be between 5 and 120 minutes'),

  body('numberOfQuestions')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Number of questions must be between 1 and 20'),

  body('requiredEducation')
    .optional()
    .isString(),

  body('targetJobRole')
    .optional()
    .isString(),

  body('focusSkills')
    .optional()
    .isArray()
    .withMessage('Focus skills must be an array of strings'),

  body('interviewExpiryDate')
    .optional({ nullable: true, checkFalsy: true })
    .isISO8601()
    .withMessage('Interview expiry date must be a valid date'),

  body('passingScoreThreshold')
    .optional()
    .isInt({ min: 0, max: 100 })
    .withMessage('Passing score threshold must be between 0 and 100'),
];

module.exports = { jobValidationRules };
