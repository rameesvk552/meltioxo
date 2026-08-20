const router = require('express').Router();
const ctrl = require('../controllers/retailSaleV2.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/preview', authenticate, tenantContext, ctrl.preview);
router.post('/', authenticate, tenantContext, ctrl.create);
module.exports = router;
