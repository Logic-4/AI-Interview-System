const User = require('../models/User');
const Interview = require('../models/Interview');
const Feedback = require('../models/Feedback');
const Question = require('../models/Question');
const Session = require('../models/Session');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { uploadAvatar, deleteBlobUrls } = require('../services/blobService');

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

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return next(ApiError.badRequest('Current password and new password are required'));
    }
    if (String(newPassword).length < 8) {
      return next(ApiError.badRequest('New password must be at least 8 characters'));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(ApiError.notFound('User not found'));
    if (user.provider !== 'local' || !user.password) {
      return next(ApiError.badRequest('Password changes are only available for password-based accounts'));
    }
    if (!(await user.comparePassword(currentPassword))) {
      return next(ApiError.unauthorized('Current password is incorrect'));
    }

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
    ApiResponse.success(res, null, 'Password changed successfully. Please sign in again.');
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    if (req.body.confirm !== 'DELETE') {
      return next(ApiError.badRequest('Type DELETE to confirm permanent account deletion'));
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(ApiError.notFound('User not found'));
    if (user.provider === 'local') {
      if (!req.body.currentPassword || !(await user.comparePassword(req.body.currentPassword))) {
        return next(ApiError.unauthorized('Current password is required to delete this account'));
      }
    }

    const interviews = await Interview.find({ user: user._id, isDeleted: { $in: [true, false] } }).select('_id recordingUrl').lean();
    const interviewIds = interviews.map((item) => item._id);
    const audioUrls = await Question.find({ interview: { $in: interviewIds } }).distinct('audioUrl');
    const blobResult = await deleteBlobUrls([
      user.avatar,
      ...interviews.map((item) => item.recordingUrl),
      ...audioUrls,
    ]);

    await Promise.all([
      Question.deleteMany({ interview: { $in: interviewIds } }),
      Feedback.deleteMany({ user: user._id }),
      Session.deleteMany({ user: user._id }),
      Interview.deleteMany({ user: user._id }),
    ]);
    await User.deleteOne({ _id: user._id });

    ApiResponse.success(res, { blobCleanupFailures: blobResult.failed.length }, 'Account permanently deleted');
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
    const scoreAgg = await Interview.aggregate([
      { $match: { user: userId, status: 'completed', overallScore: { $ne: null } } },
      {
        $group: {
          _id: null,
          averageScore: { $avg: '$overallScore' },
          highestScore: { $max: '$overallScore' },
          lowestScore: { $min: '$overallScore' },
          totalScored: { $sum: 1 },
        },
      },
    ]);

    // Get recent interviews
    const recentInterviews = await Interview.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title type domain difficulty status overallScore createdAt');

    // Get score trend (last 10 completed interviews)
    const scoredTrend = await Interview.find({
      user: userId,
      status: 'completed',
      overallScore: { $ne: null },
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('overallScore completedAt createdAt')
      .lean();

    const trendFeedback = await Feedback.find({ interview: { $in: scoredTrend.map((item) => item._id) } })
      .select('interview categories')
      .lean();
    const feedbackByInterview = new Map(trendFeedback.map((item) => [String(item.interview), item]));
    const scoreTrend = scoredTrend.map((item) => ({
      _id: item._id,
      overallScore: item.overallScore,
      categories: feedbackByInterview.get(String(item._id))?.categories,
      createdAt: item.completedAt || item.createdAt,
    }));

    const stats = scoreAgg[0] || { averageScore: 0, highestScore: 0, lowestScore: 0, totalScored: 0 };

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
        totalReviewed: stats.totalScored,
      },
      recentInterviews,
      scoreTrend: scoreTrend.reverse(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  deleteAccount,
  getDashboard,
};
