const { body, param, query } = require('express-validator');

const createQuestionValidator = [
  body('text')
    .trim()
    .notEmpty()
    .withMessage('Question text is required'),

  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),

  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .isIn(['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'])
    .withMessage('Invalid domain'),

  body('difficulty')
    .notEmpty()
    .withMessage('Difficulty is required')
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Difficulty must be easy, medium, or hard'),

  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['technical', 'behavioral', 'system-design'])
    .withMessage('Type must be technical, behavioral, or system-design'),

  body('sampleAnswer')
    .optional()
    .isString()
    .withMessage('Sample answer must be a string'),

  body('tags')
    .optional()
    .isArray()
    .withMessage('Tags must be an array'),
];

const generateQuestionsValidator = [
  body('type')
    .notEmpty()
    .withMessage('Type is required')
    .isIn(['technical', 'behavioral', 'system-design'])
    .withMessage('Invalid type'),

  body('domain')
    .notEmpty()
    .withMessage('Domain is required')
    .isIn(['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'])
    .withMessage('Invalid domain'),

  body('difficulty')
    .notEmpty()
    .withMessage('Difficulty is required')
    .isIn(['junior', 'mid', 'senior', 'lead'])
    .withMessage('Invalid difficulty'),

  body('count')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Count must be between 1 and 20'),
];

const listQuestionsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),

  query('domain')
    .optional()
    .isIn(['technology', 'healthcare', 'finance', 'engineering', 'education', 'legal'])
    .withMessage('Invalid domain'),

  query('difficulty')
    .optional()
    .isIn(['easy', 'medium', 'hard'])
    .withMessage('Invalid difficulty'),

  query('type')
    .optional()
    .isIn(['technical', 'behavioral', 'system-design'])
    .withMessage('Invalid type'),
];

module.exports = {
  createQuestionValidator,
  generateQuestionsValidator,
  listQuestionsValidator,
};
