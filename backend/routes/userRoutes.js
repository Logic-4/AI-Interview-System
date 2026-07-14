const express = require('express');
const router = express.Router();
const { getProfile, updateProfile, updateAvatar, changePassword, deleteAccount, getDashboard } = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

// All routes are protected
router.use(protect);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.put('/avatar', upload.single('avatar'), updateAvatar);
router.put('/password', changePassword);
router.delete('/account', deleteAccount);
router.get('/dashboard', getDashboard);

module.exports = router;
