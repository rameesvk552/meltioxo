const router = require('express').Router();
const ctrl = require('../controllers/production.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/', authenticate, tenantContext, ctrl.create);
router.post('/:id/start', authenticate, tenantContext, ctrl.start);
router.get('/:id/availability', authenticate, tenantContext, ctrl.availability);
router.post('/:id/complete', authenticate, tenantContext, ctrl.complete);
router.post('/:id/cancel', authenticate, tenantContext, ctrl.cancel);

module.exports = router;
