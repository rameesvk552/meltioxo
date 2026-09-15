const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { requireViewPermission } = require('../middleware/permission');

router.get('/revenue-flow', authenticate, tenantContext, requireViewPermission('dashboard'), ctrl.revenueFlow);

module.exports = router;
