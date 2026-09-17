const router = require('express').Router();
const ctrl = require('../controllers/report.controller');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { requireViewPermission } = require('../middleware/permission');

router.get('/trial-balance', authenticate, tenantContext, requireViewPermission('reports.trial_balance'), ctrl.trialBalance);
router.get('/profit-loss', authenticate, tenantContext, requireViewPermission('reports.profit_loss'), ctrl.profitLoss);
router.get('/profit-loss-statement', authenticate, tenantContext, requireViewPermission('reports.profit_loss'), ctrl.profitLossStatement);
router.get('/purchases', authenticate, tenantContext, requireViewPermission('purchases'), ctrl.purchaseReport);
router.get('/balance-sheet', authenticate, tenantContext, requireViewPermission('reports.balance_sheet'), ctrl.balanceSheet);
router.get('/cash-flow', authenticate, tenantContext, requireViewPermission('reports.balance_sheet'), ctrl.cashFlow);
router.get('/aging-payables', authenticate, tenantContext, requireViewPermission('finance.payables'), ctrl.agingPayables);
router.get('/aging-receivables', authenticate, tenantContext, requireViewPermission('finance.receivables'), ctrl.agingReceivables);
router.get('/stock', authenticate, tenantContext, requireViewPermission('reports.stock'), ctrl.stockReport);
router.get('/production', authenticate, tenantContext, requireViewPermission('reports.production'), ctrl.productionReport);

module.exports = router;
