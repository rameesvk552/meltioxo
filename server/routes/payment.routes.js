const router = require('express').Router();
const ctrl = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');
const { validate } = require('../middleware/validate');
const { createPaymentSchema } = require('../validators/payment.validator');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/unpaid-invoices', authenticate, tenantContext, ctrl.getUnpaidInvoices);
router.get('/:id', authenticate, tenantContext, ctrl.getById);
router.post('/outgoing', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), validate(createPaymentSchema), ctrl.createOutgoing);
router.post('/incoming', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), validate(createPaymentSchema), ctrl.createIncoming);

module.exports = router;
