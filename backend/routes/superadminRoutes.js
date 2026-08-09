const express = require('express');
const { body, param, query } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');
const controller = require('../controllers/companyController');
const userController = require('../controllers/superadminUserController');
const settingsController = require('../controllers/superadminSettingsController');

const router = express.Router();
const statuses = ['active', 'suspended', 'disabled'];
const companyPayload = [
  body('name').trim().isLength({ min: 2, max: 150 }).withMessage('Company name must be between 2 and 150 characters'),
  body('contactEmail').trim().isEmail().normalizeEmail().withMessage('A valid company email is required'),
];

router.use(protect, authorize('superadmin'));
router.get('/dashboard', controller.dashboard);
router.get('/settings/profile', settingsController.getProfile);
router.put('/settings/profile', [body('name').trim().isLength({ min: 2, max: 50 }), body('email').trim().isEmail().normalizeEmail()], validate, settingsController.updateProfile);
router.put('/settings/password', [body('currentPassword').notEmpty(), body('newPassword').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)], validate, settingsController.updatePassword);
router.get('/companies', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, controller.listCompanies);
router.get('/companies/:id', [param('id').isMongoId()], validate, controller.getCompany);
router.post('/companies', [...companyPayload, body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/), body('status').optional().isIn(statuses)], validate, controller.createCompany);
router.put('/companies/:id', [param('id').isMongoId(), ...companyPayload, body('status').optional().isIn(statuses)], validate, controller.updateCompany);
router.patch('/companies/:id/status', [param('id').isMongoId(), body('status').isIn(statuses)], validate, controller.updateCompanyStatus);
router.post('/companies/:id/reset-password', [param('id').isMongoId(), body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)], validate, controller.resetCompanyPassword);
router.delete('/companies/:id', [param('id').isMongoId()], validate, controller.deleteCompany);

const allowedUserRoles = ['user', 'company'];
const userPayload = [body('name').trim().isLength({ min: 2, max: 50 }), body('email').trim().isEmail().normalizeEmail()];
router.get('/users', [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })], validate, userController.listUsers);
router.post('/users', [...userPayload, body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/), body('role').optional().isIn(allowedUserRoles), body('status').optional().isIn(['active', 'disabled'])], validate, userController.createUser);
router.put('/users/:id', [param('id').isMongoId(), ...userPayload, body('role').optional().isIn(allowedUserRoles)], validate, userController.updateUser);
router.patch('/users/:id/status', [param('id').isMongoId(), body('status').isIn(['active', 'disabled'])], validate, userController.updateUserStatus);
router.post('/users/:id/reset-password', [param('id').isMongoId(), body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)], validate, userController.resetUserPassword);
router.delete('/users/:id', [param('id').isMongoId()], validate, userController.deleteUser);

module.exports = router;
