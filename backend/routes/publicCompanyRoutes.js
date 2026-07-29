const express = require('express');
const {
  getPublicCompanyProfile,
  getPublicCompanyJobs,
  getPublicJobDetails,
  applyPublicJob,
  uploadCandidateBlobFile,
} = require('../controllers/publicCompanyController');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/jobs/:jobId', getPublicJobDetails);
router.post('/jobs/:jobId/apply', applyPublicJob);
router.post('/upload-blob', upload.single('file'), uploadCandidateBlobFile);
router.get('/:companyId', getPublicCompanyProfile);
router.get('/:companyId/jobs', getPublicCompanyJobs);

module.exports = router;
