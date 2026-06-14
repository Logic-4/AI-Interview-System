const express = require('express');
const router = express.Router();
const { getKaggleConfig, updateKaggleConfig } = require('../controllers/kaggleController');
const { protect } = require('../middleware/auth');

// All routes are protected
router.use(protect);

router.route('/config')
  .get(getKaggleConfig)
  .post(updateKaggleConfig);

module.exports = router;
