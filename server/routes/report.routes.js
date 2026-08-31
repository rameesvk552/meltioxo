const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

router.get('/trial-balance', authenticate, tenantContext, ctrl.trialBalance);
router.get('/profit-loss', authenticate, tenantContext, ctrl.profitLoss);
router.get('/profit-loss-statement', authenticate, tenantContext, ctrl.profitLossStatement);
router.get('/purchases', authenticate, tenantContext, ctrl.purchaseReport);
router.get('/balance-sheet', authenticate, tenantContext, ctrl.balanceSheet);
router.get('/cash-flow', authenticate, tenantContext, ctrl.cashFlow);
router.get('/aging-payables', authenticate, tenantContext, ctrl.agingPayables);
router.get('/aging-receivables', authenticate, tenantContext, ctrl.agingReceivables);
router.get('/stock', authenticate, tenantContext, ctrl.stockReport);
router.get('/production', authenticate, tenantContext, ctrl.productionReport);

module.exports = router;
