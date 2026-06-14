const SystemConfig = require('../models/SystemConfig');
const kaggleService = require('../services/kaggleService');

/**
 * Get current Kaggle config and live status
 * GET /api/v1/kaggle/config
 */
exports.getKaggleConfig = async (req, res, next) => {
  try {
    const status = await kaggleService.checkKaggleStatus();
    
    res.status(200).json({
      success: true,
      data: {
        url: status.url || '',
        status: status.status,
        model: status.model || null,
        error: status.error || null,
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Kaggle URL in MongoDB and cache
 * POST /api/v1/kaggle/config
 */
exports.updateKaggleConfig = async (req, res, next) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({
        success: false,
        message: 'Kaggle URL is required.'
      });
    }

    const trimmedUrl = url.trim().replace(/\/+$/, '');
    
    // Save to Database
    await SystemConfig.findOneAndUpdate(
      { key: 'KAGGLE_API_URL' },
      { value: trimmedUrl },
      { upsert: true, new: true }
    );
    
    // Update local cache
    kaggleService.setKaggleBaseUrl(trimmedUrl);
    
    // Check new status
    const status = await kaggleService.checkKaggleStatus();

    res.status(200).json({
      success: true,
      message: 'Kaggle API URL updated successfully.',
      data: {
        url: trimmedUrl,
        status: status.status,
        model: status.model || null,
        error: status.error || null,
      }
    });
  } catch (error) {
    next(error);
  }
};
