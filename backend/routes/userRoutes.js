const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { getProfile, updateProfile, updateAvatar, changePassword, deleteAccount, getDashboard } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const validate = require('../middleware/validate');

// All routes are protected
router.use(protect);

const profileValidator = [
  body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters')
    .matches(/^[a-zA-Z\s]+$/).withMessage('Name must contain only letters'),
  body('bio').optional().trim().isLength({ max: 500 }).withMessage('Bio cannot exceed 500 characters'),
  body('targetRole').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Target role must be 2–100 characters')
    .matches(/^[a-zA-Z\s'\-./&,()]+$/).withMessage('Target role contains invalid characters'),
  body('experienceLevel').optional().isIn(['entry', 'mid', 'senior', 'lead']).withMessage('Invalid experience level'),
  body('skills').optional().isArray().withMessage('Skills must be an array'),
];

router.get('/profile', getProfile);
router.put('/profile', profileValidator, validate, updateProfile);
router.put('/avatar', upload.single('avatar'), updateAvatar);
router.put('/password', changePassword);
router.delete('/account', deleteAccount);
router.get('/dashboard', getDashboard);

module.exports = router;
