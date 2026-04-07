const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateAvatar, getDashboard, getAllUsers } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/avatar', upload.single('avatar'), updateAvatar);
router.get('/dashboard', getDashboard);

// Admin only
router.get('/', authorize('admin'), getAllUsers);

module.exports = router;
