const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { AppError } = require('../middleware/errorHandler');
const { hasViewPermission } = require('../middleware/permission');

const requireDashboardView = (req, res, next) => {
  if (hasViewPermission(req.user, 'dashboard')) return next();
  return next(new AppError('You do not have permission to view this information', 403));
};

router.get('/revenue-flow', authenticate, tenantContext, requireDashboardView, ctrl.revenueFlow);

module.exports = router;
