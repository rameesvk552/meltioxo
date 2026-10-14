const router = require('express').Router();
const ctrl = require('../controllers/auditLog.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');

const canViewAudit = authorize('super_admin', 'admin', 'accountant', 'manager');

router.get('/filters', authenticate, tenantContext, canViewAudit, ctrl.getFilters);
router.get('/', authenticate, tenantContext, canViewAudit, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, canViewAudit, ctrl.getById);

module.exports = router;
