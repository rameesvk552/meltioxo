const router = require('express').Router();
const ctrl = require('../controllers/account.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');

router.get('/', authenticate, tenantContext, ctrl.getAll);
router.get('/cash-bank-ledgers', authenticate, tenantContext, ctrl.getCashBankLedgers);
router.get('/payment-method-ledgers', authenticate, tenantContext, ctrl.getCashBankLedgers);
router.get('/payment-methods', authenticate, tenantContext, ctrl.getPaymentMethods);
router.get('/next-code', authenticate, tenantContext, ctrl.getNextCode);
router.post('/payment-methods', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.createPaymentMethod);
router.patch('/payment-methods/:id', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.updatePaymentMethod);
router.post('/', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.create);
router.put('/:id', authenticate, tenantContext, authorize('super_admin', 'admin', 'accountant'), ctrl.update);
router.get('/:id/ledger', authenticate, tenantContext, ctrl.getLedger);

module.exports = router;
