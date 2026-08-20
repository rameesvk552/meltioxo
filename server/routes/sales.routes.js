const router = require('express').Router();
const ctrl = require('../controllers/sales.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/', authenticate, tenantContext, ctrl.getCustomers);
router.get('/:id', authenticate, tenantContext, ctrl.getCustomerById);
router.post('/', authenticate, tenantContext, ctrl.createCustomer);
router.put('/:id', authenticate, tenantContext, ctrl.updateCustomer);

module.exports = router;
