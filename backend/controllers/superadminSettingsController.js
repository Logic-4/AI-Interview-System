const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return next(ApiError.notFound('Superadmin account not found'));
    ApiResponse.success(res, { user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return next(ApiError.notFound('Superadmin account not found'));

    if (email !== user.email) {
      const emailTaken = await User.exists({ email, _id: { $ne: user._id } });
      if (emailTaken) return next(ApiError.badRequest('Another account already uses this email address'));
      user.email = email;
    }
    user.name = name;
    await user.save();
    ApiResponse.success(res, { user: user.toSafeObject() }, 'Superadmin profile updated');
  } catch (error) {
    next(error);
  }
};

const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return next(ApiError.notFound('Superadmin account not found'));
    if (!(await user.comparePassword(currentPassword))) return next(ApiError.unauthorized('Current password is incorrect'));

    user.password = newPassword;
    user.refreshTokens = [];
    await user.save();
    ApiResponse.success(res, null, 'Password changed successfully. Please sign in again.');
  } catch (error) {
    next(error);
  }
};

module.exports = { getProfile, updateProfile, updatePassword };
