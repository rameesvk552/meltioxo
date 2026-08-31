const { AppError } = require('./errorHandler');
const { setAuditTenant, setAuditBranch } = require('./auditContext');
const db = require('../models');

exports.tenantContext = async (req, res, next) => {
  try {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }

  if (req.user.role === 'SUPER_ADMIN' || req.user.role === 'super_admin') {
    // Super admin can specify tenantId in query or body
    req.tenantId = req.query.tenant_id || req.body.tenant_id || req.user.tenant_id;
  } else {
    req.tenantId = req.user.tenant_id;
  }

  if (!req.tenantId && req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'super_admin') {
    return next(new AppError('Tenant context missing', 403));
  }

  const requestedBranch = req.get('x-branch-id') || req.query.branch_id || req.body.branch_id;
  const branch = requestedBranch
    ? await db.branch.findOne({ where: { id: requestedBranch, tenant_id: req.tenantId, is_active: true } })
    : await db.branch.findOne({ where: { tenant_id: req.tenantId, is_default: true, is_active: true } });
  if (requestedBranch && !branch) return next(new AppError('Branch not found or inactive', 404));
  if (branch && !['admin', 'super_admin', 'SUPER_ADMIN'].includes(req.user.role) && req.user.branch_id && req.user.branch_id !== branch.id) {
    return next(new AppError('You do not have access to this branch', 403));
  }
  req.branchId = branch?.id || null;
  setAuditTenant(req.tenantId);
  setAuditBranch(req.branchId);
  next();
  } catch (error) { next(error); }
};
