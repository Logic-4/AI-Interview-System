const express = require('express');
const {
  getPublicCompanyProfile,
  getPublicCompanyJobs,
  getPublicJobDetails,
  applyPublicJob,
} = require('../controllers/publicCompanyController');

const router = express.Router();

router.get('/jobs/:jobId', getPublicJobDetails);
router.post('/jobs/:jobId/apply', applyPublicJob);
router.get('/:companyId', getPublicCompanyProfile);
router.get('/:companyId/jobs', getPublicCompanyJobs);

module.exports = router;
