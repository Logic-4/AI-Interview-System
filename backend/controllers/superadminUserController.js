const User = require('../models/User');
const Company = require('../models/Company');
const Interview = require('../models/Interview');
const Question = require('../models/Question');
const Feedback = require('../models/Feedback');
const Session = require('../models/Session');
const Assessment = require('../models/Assessment');
const VerificationEvent = require('../models/VerificationEvent');
const Application = require('../models/Application');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const { deleteBlobUrls } = require('../services/blobService');
const { cascadeDeleteCompanyData } = require('./companyController');

const MANAGEABLE_ROLES = ['user', 'company', 'admin'];
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
    const assignable = ['user', 'company'];
    if (!assignable.includes(role)) return next(ApiError.badRequest('Invalid role'));
    if (await User.findOne({ email })) return next(ApiError.badRequest('A user with this email already exists'));
    if (role === 'company' && await Company.findOne({ contactEmail: email })) {
      return next(ApiError.badRequest('A company account with this email already exists'));
    }

    const user = await User.create({ name, email, password, role, accountStatus: status });

    if (role === 'company') {
      try {
        const company = await Company.create({
          name, contactEmail: email,
          status: status === 'disabled' ? 'disabled' : 'active',
          adminUser: user._id, createdBy: req.user._id,
        });
        user.company = company._id;
        await user.save();
      } catch (err) {
        await user.deleteOne();
        throw err;
      }
    }

    ApiResponse.created(res, { user: user.toSafeObject() }, 'User created successfully');
  } catch (error) { next(error); }
};

const updateUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || !MANAGEABLE_ROLES.includes(user.role)) return next(ApiError.notFound('User not found'));
    const newEmail = req.body.email;
    if (newEmail && newEmail !== user.email) {
      if (await User.findOne({ email: newEmail, _id: { $ne: user._id } })) return next(ApiError.badRequest('Email already in use'));
    }
    if (req.body.name) user.name = req.body.name;
    if (newEmail) user.email = newEmail;
    const newRole = req.body.role;
    if (newRole && ['user', 'company'].includes(newRole)) {
      user.role = newRole;
      if (newRole === 'company' && !user.company) {
        const company = await Company.create({
          name: user.name, contactEmail: user.email,
          adminUser: user._id, createdBy: req.user._id,
        });
        user.company = company._id;
      }
    }
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

    // A 'company' user is always that company's 1:1 adminUser (see
    // createUser/updateUser above). Deleting them used to also delete the
    // Company — unconditionally, with no check for other linked users, and
    // only cleaning interviews owned by the admin account itself. Real
    // candidate interviews for that company are owned by separate candidate
    // users and linked via Interview.company, not Interview.user, so they
    // were never touched — the exact "database gap" this fixes. Deleting the
    // company's data now goes through the same guarded cascade as the
    // dedicated "Delete Company" action instead of duplicating (and
    // under-covering) it here.
    if (user.role === 'company' && user.company) {
      const linkedUsers = await User.countDocuments({ company: user.company, _id: { $ne: user._id } });
      if (linkedUsers > 0) {
        return next(ApiError.badRequest('Company cannot be deleted while it still has associated users. Remove them first.'));
      }
      await cascadeDeleteCompanyData(user.company);
      await Company.findByIdAndDelete(user.company);
    }

    const interviewIds = await Interview.find({ user: user._id }).distinct('_id');
    if (interviewIds.length) {
      const audioUrls = await Question.find({ interview: { $in: interviewIds } }).distinct('audioUrl');
      const interviewBlobs = await Interview.find({ _id: { $in: interviewIds } })
        .select('recordingUrl recordingChunks').lean();
      const recordingUrls = interviewBlobs.map((i) => i.recordingUrl).filter(Boolean);
      const chunkUrls = interviewBlobs.flatMap((i) => (i.recordingChunks || []).map((c) => c.url));
      await deleteBlobUrls([...recordingUrls, ...chunkUrls, ...audioUrls]);
    }
    await Promise.all([
      Question.deleteMany({ interview: { $in: interviewIds } }),
      Assessment.deleteMany({ interview: { $in: interviewIds } }),
      VerificationEvent.deleteMany({ interview: { $in: interviewIds } }),
      Application.deleteMany({ candidate: user._id }),
      Feedback.deleteMany({ interview: { $in: interviewIds } }),
      Session.deleteMany({ interview: { $in: interviewIds } }),
      Interview.deleteMany({ user: user._id }),
    ]);

    await user.deleteOne();
    ApiResponse.success(res, null, 'User deleted successfully');
  } catch (error) { next(error); }
};

module.exports = { listUsers, createUser, updateUser, updateUserStatus, resetUserPassword, deleteUser };
