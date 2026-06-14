const User = require('../models/User');
const Interview = require('../models/Interview');
const Feedback = require('../models/Feedback');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadAvatar } = require('../services/blobService');

/**
 * @desc    Get user profile
 * @route   GET /api/v1/users/profile
 * @access  Private
 */
const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    ApiResponse.success(res, { user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/v1/users/profile
 * @access  Private
 */
const updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['name', 'bio', 'skills', 'targetRole', 'experienceLevel'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    ApiResponse.success(res, { user: user.toSafeObject() }, 'Profile updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload user avatar
 * @route   PUT /api/v1/users/avatar
 * @access  Private
 */
const updateAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(ApiError.badRequest('Please upload an image file'));
    }

    const { url } = await uploadAvatar(req.file.buffer, req.user._id.toString());

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: url },
      { new: true }
    );

    ApiResponse.success(res, { user: user.toSafeObject() }, 'Avatar updated');
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get user dashboard stats
 * @route   GET /api/v1/users/dashboard
 * @access  Private
 */
const getDashboard = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // Get interview stats
    const [
      totalInterviews,
      completedInterviews,
      inProgressInterviews,
      scheduledInterviews,
    ] = await Promise.all([
      Interview.countDocuments({ user: userId }),
      Interview.countDocuments({ user: userId, status: 'completed' }),
      Interview.countDocuments({ user: userId, status: 'in-progress' }),
      Interview.countDocuments({ user: userId, status: 'scheduled' }),
    ]);

    // Get average score
    const scoreAgg = await Feedback.aggregate([
      { $match: { user: userId } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$overallScore' },
          highestScore: { $max: '$overallScore' },
          lowestScore: { $min: '$overallScore' },
          totalFeedbacks: { $sum: 1 },
        },
      },
    ]);

    // Get recent interviews
    const recentInterviews = await Interview.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title type domain difficulty status overallScore createdAt');

    // Get score trend (last 10 completed interviews)
    const scoreTrend = await Feedback.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('overallScore categories createdAt')
      .lean();

    const stats = scoreAgg[0] || { averageScore: 0, highestScore: 0, lowestScore: 0, totalFeedbacks: 0 };

    ApiResponse.success(res, {
      overview: {
        totalInterviews,
        completedInterviews,
        inProgressInterviews,
        scheduledInterviews,
      },
      scores: {
        average: Math.round(stats.averageScore || 0),
        highest: stats.highestScore || 0,
        lowest: stats.lowestScore || 0,
        totalReviewed: stats.totalFeedbacks,
      },
      recentInterviews,
      scoreTrend: scoreTrend.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all users (admin only)
 * @route   GET /api/v1/users
 * @access  Private/Admin
 */
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-refreshTokens')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      User.countDocuments(filter),
    ]);

    ApiResponse.paginated(res, users, {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  getDashboard,
  getAllUsers,
};
