const User = require('../models/User');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const MANAGEABLE_ROLES = ['user', 'candidate', 'company', 'interviewer'];
const normalize = (v, fallback, max) => Math.min(Math.max(parseInt(v, 10) || fallback, 1), max);

const listUsers = async (req, res, next) => {
  try {
    const page = normalize(req.query.page, 1, 100000);
    const limit = normalize(req.query.limit, 10, 100);
    const { search = '', role, status } = req.query;
    const filter = { role: { $in: MANAGEABLE_ROLES } };
    if (role && MANAGEABLE_ROLES.includes(role)) filter.role = role;
    if (status) filter.accountStatus = status;
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { email: pattern }];
    }
    const [users, total] = await Promise.all([
      User.find(filter).select('name email role accountStatus lastLogin createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);
    ApiResponse.success(res, { users, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, password, role = 'user', status = 'active' } = req.body;
    if (!MANAGEABLE_ROLES.includes(role)) return next(ApiError.badRequest('Invalid role'));
    if (await User.findOne({ email })) return next(ApiError.badRequest('A user with this email already exists'));
    const user = await User.create({ name, email, password, role, accountStatus: status });
    ApiResponse.created(res, { user: user.toSafeObject() }, 'User created successfully');
  } catch (error) { next(error); }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !MANAGEABLE_ROLES.includes(user.role)) return next(ApiError.notFound('User not found'));
    if (req.body.email && req.body.email !== user.email) {
      if (await User.findOne({ email: req.body.email, _id: { $ne: user._id } })) return next(ApiError.badRequest('Email already in use'));
    }
    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.role && MANAGEABLE_ROLES.includes(req.body.role)) user.role = req.body.role;
    await user.save();
    ApiResponse.success(res, { user: user.toSafeObject() }, 'User updated successfully');
  } catch (error) { next(error); }
};

const updateUserStatus = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !MANAGEABLE_ROLES.includes(user.role)) return next(ApiError.notFound('User not found'));
    user.accountStatus = req.body.status;
    if (req.body.status === 'disabled') user.refreshTokens = [];
    await user.save();
    ApiResponse.success(res, { user: user.toSafeObject() }, `User ${req.body.status}`);
  } catch (error) { next(error); }
};

const resetUserPassword = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('+password');
    if (!user || !MANAGEABLE_ROLES.includes(user.role)) return next(ApiError.notFound('User not found'));
    user.password = req.body.password;
    user.refreshTokens = [];
    await user.save();
    ApiResponse.success(res, null, 'User password reset successfully');
  } catch (error) { next(error); }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !MANAGEABLE_ROLES.includes(user.role)) return next(ApiError.notFound('User not found'));
    await user.deleteOne();
    ApiResponse.success(res, null, 'User deleted successfully');
  } catch (error) { next(error); }
};

module.exports = { listUsers, createUser, updateUser, updateUserStatus, resetUserPassword, deleteUser };
