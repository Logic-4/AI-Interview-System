const ApiError = require('../utils/ApiError');
const Company = require('../models/Company');

/**
 * Middleware ensuring the authenticated user belongs to a company and has access to the Company Portal
 */
const requireCompanyAccess = async (req, _res, next) => {
  try {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    // Role check: 'company', 'admin' (with company), or 'superadmin'
    const allowedRoles = ['company', 'admin', 'superadmin'];
    if (!allowedRoles.includes(req.user.role)) {
      return next(ApiError.forbidden('Access denied. Company role required.'));
    }

    // Superadmin override: can pass ?companyId= or header if needed, else requires company membership
    let companyId = req.user.company;
    if (req.user.role === 'superadmin' && req.query.companyId) {
      companyId = req.query.companyId;
    }

    if (!companyId) {
      return next(ApiError.forbidden('No company associated with this account. Access denied.'));
    }

    // Check that company is active
    const company = await Company.findById(companyId);
    if (!company) {
      return next(ApiError.notFound('Company not found.'));
    }
    if (company.status !== 'active') {
      return next(ApiError.forbidden(`Company account is currently ${company.status}.`));
    }

    req.companyId = company._id;
    req.company = company;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { requireCompanyAccess };
