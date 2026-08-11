const express = require('express');
const {
  getAllPublicJobs,
  getPublicCompanyProfile,
  getPublicCompanyJobs,
  getPublicJobDetails,
  applyPublicJob,
  uploadCandidateBlobFile,
} = require('../controllers/publicCompanyController');
const { applyLimiter } = require('../middleware/rateLimiter');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/jobs', getAllPublicJobs);
router.get('/jobs/:jobId', getPublicJobDetails);
router.post('/jobs/:jobId/apply', applyLimiter, applyPublicJob);
router.post('/upload-blob', upload.single('file'), uploadCandidateBlobFile);
router.get('/:companyId', getPublicCompanyProfile);
router.get('/:companyId/jobs', getPublicCompanyJobs);

module.exports = router;
