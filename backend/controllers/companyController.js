const Company = require('../models/Company');
const User = require('../models/User');
const Interview = require('../models/Interview');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');

const tenantUserFields = 'name email username lastLogin accountStatus createdAt';
const normalizePagination = (value, fallback, max) => Math.min(Math.max(parseInt(value, 10) || fallback, 1), max);

const listCompanies = async (req, res, next) => {
  try {
    const page = normalizePagination(req.query.page, 1, 100000);
    const limit = normalizePagination(req.query.limit, 10, 100);
    const { search = '', status, subscriptionStatus } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (subscriptionStatus) filter.subscriptionStatus = subscriptionStatus;
    if (search.trim()) {
      const pattern = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: pattern }, { contactEmail: pattern }];
    }
    const [companies, total] = await Promise.all([
      Company.find(filter).populate('adminUser', tenantUserFields).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Company.countDocuments(filter),
    ]);
    ApiResponse.success(res, { companies, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
};

const getCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id).populate('adminUser', tenantUserFields).lean();
    if (!company) return next(ApiError.notFound('Company not found'));
    const [userCount, interviewCount] = await Promise.all([
      User.countDocuments({ company: company._id }),
      Interview.countDocuments({ company: company._id }),
    ]);
    ApiResponse.success(res, { company: { ...company, metrics: { userCount, interviewCount, jobPostCount: 0 } } });
  } catch (error) { next(error); }
};

const createCompany = async (req, res, next) => {
  try {
    const { name, contactEmail, password, status = 'active' } = req.body;
    const existing = await User.findOne({ email: contactEmail });
    if (existing || await Company.exists({ contactEmail })) return next(ApiError.badRequest('A company account with this email already exists'));

    const company = await Company.create({ name, contactEmail, status, createdBy: req.user._id });
    try {
      const adminUser = await User.create({
        name,
        email: contactEmail,
        password,
        role: 'admin',
        company: company._id,
        accountStatus: status === 'disabled' ? 'disabled' : 'active',
      });
      company.adminUser = adminUser._id;
      await company.save();
    } catch (error) {
      await Company.findByIdAndDelete(company._id);
      throw error;
    }
    const populated = await Company.findById(company._id).populate('adminUser', tenantUserFields);
    ApiResponse.created(res, { company: populated }, 'Company created successfully');
  } catch (error) { next(error); }
};

const updateCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return next(ApiError.notFound('Company not found'));
    const previousEmail = company.contactEmail;
    const fields = ['name', 'contactEmail'];
    fields.forEach((field) => { if (req.body[field] !== undefined) company[field] = req.body[field]; });
    if (req.body.contactEmail && req.body.contactEmail !== previousEmail) {
      const duplicate = await Company.exists({ contactEmail: req.body.contactEmail, _id: { $ne: company._id } });
      if (duplicate) return next(ApiError.badRequest('Another company already uses this email'));
    }
    if (company.adminUser) {
      if (req.body.contactEmail) {
        const duplicateUser = await User.exists({ email: company.contactEmail, _id: { $ne: company.adminUser } });
        if (duplicateUser) return next(ApiError.badRequest('Another account already uses this email'));
      }
    }
    await company.save();
    if (company.adminUser) {
      const account = await User.findById(company.adminUser);
      if (account) {
        account.name = company.name;
        if (req.body.contactEmail && req.body.contactEmail !== account.email) {
          account.email = company.contactEmail;
        }
        await account.save();
      }
    }
    const populated = await Company.findById(company._id).populate('adminUser', tenantUserFields);
    ApiResponse.success(res, { company: populated }, 'Company updated successfully');
  } catch (error) { next(error); }
};

const updateCompanyStatus = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return next(ApiError.notFound('Company not found'));
    company.status = req.body.status;
    await company.save();
    if (company.adminUser) {
      const userStatus = req.body.status === 'active' ? 'active' : 'disabled';
      await User.findByIdAndUpdate(company.adminUser, { accountStatus: userStatus, ...(userStatus === 'disabled' ? { refreshTokens: [] } : {}) });
    }
    ApiResponse.success(res, { company }, `Company ${req.body.status === 'active' ? 'reactivated' : req.body.status}`);
  } catch (error) { next(error); }
};

const resetCompanyPassword = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company?.adminUser) return next(ApiError.notFound('Company administrator account not found'));
    const user = await User.findById(company.adminUser).select('+password');
    user.password = req.body.password;
    user.refreshTokens = [];
    await user.save();
    ApiResponse.success(res, null, 'Company administrator password reset successfully');
  } catch (error) { next(error); }
};

const deleteCompany = async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return next(ApiError.notFound('Company not found'));
    const linkedUsers = await User.countDocuments({ company: company._id, _id: { $ne: company.adminUser } });
    if (linkedUsers > 0) return next(ApiError.badRequest('Company cannot be deleted while it still has associated users'));
    if (company.adminUser) await User.findByIdAndDelete(company.adminUser);
    await company.deleteOne();
    ApiResponse.success(res, null, 'Company deleted successfully');
  } catch (error) { next(error); }
};

const dashboard = async (req, res, next) => {
  try {
    const [totalCompanies, activeCompanies, suspendedCompanies, totalCandidates, totalInterviews, recentCompanies] = await Promise.all([
      Company.countDocuments(), Company.countDocuments({ status: 'active' }), Company.countDocuments({ status: 'suspended' }),
      User.countDocuments({ role: 'user', company: { $ne: null } }), Interview.countDocuments(),
      Company.find().populate('adminUser', tenantUserFields).sort({ createdAt: -1 }).limit(6).lean(),
    ]);
    const companyStatus = await Company.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);
    ApiResponse.success(res, {
      metrics: { totalCompanies, activeCompanies, suspendedCompanies, totalCandidates, totalInterviews, totalJobPosts: 0 },
      recentCompanies,
      companyStatus,
      subscription: { active: 0, trial: 0, pastDue: 0, label: 'Subscription management will be available in a future release.' },
    });
  } catch (error) { next(error); }
};

module.exports = { listCompanies, getCompany, createCompany, updateCompany, updateCompanyStatus, resetCompanyPassword, deleteCompany, dashboard };
