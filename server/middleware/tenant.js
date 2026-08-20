const { AppError } = require('./errorHandler');

exports.tenantContext = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('User not authenticated', 401));
  }

  if (req.user.role === 'SUPER_ADMIN') {
    // Super admin can specify tenantId in query or body
    req.tenantId = req.query.tenant_id || req.body.tenant_id || req.user.tenant_id;
  } else {
    req.tenantId = req.user.tenant_id;
  }

  if (!req.tenantId && req.user.role !== 'SUPER_ADMIN') {
    return next(new AppError('Tenant context missing', 403));
  }

  next();
};
