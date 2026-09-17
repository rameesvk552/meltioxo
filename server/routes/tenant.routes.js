const router = require('express').Router();
const ctrl = require('../controllers/tenant.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { authorize } = require('../middleware/permission');
const whatsappCtrl = require('../controllers/whatsappConnection.controller');

router.get('/settings', authenticate, tenantContext, ctrl.getSettings);
router.put('/settings', authenticate, tenantContext, ctrl.updateSettings);
router.put('/whatsapp-invoice-settings', authenticate, tenantContext, authorize('super_admin', 'admin'), ctrl.updateWhatsappInvoiceSettings);
router.get('/whatsapp-connection', authenticate, tenantContext, whatsappCtrl.getConnection);
router.post('/whatsapp-connection/connect', authenticate, tenantContext, authorize('super_admin', 'admin'), whatsappCtrl.startConnection);
router.post('/whatsapp-connection/complete', authenticate, tenantContext, authorize('super_admin', 'admin'), whatsappCtrl.completeConnection);
router.delete('/whatsapp-channels/:channelId', authenticate, tenantContext, authorize('super_admin', 'admin'), whatsappCtrl.disconnectChannel);

module.exports = router;
