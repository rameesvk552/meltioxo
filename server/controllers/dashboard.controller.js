const db = require('../models');
const { hasDashboardWidgetPermission } = require('../middleware/permission');
const { ACCOUNT_CODES } = require('../config/constants');

const flowWidgets = ['cash_collected', 'bank_collected', 'cash_paid', 'bank_paid', 'cash_balance', 'bank_balance'];

const isCashPayment = item => item.paymentMethod?.method_type === 'CASH';

exports.revenueFlow = async (req, res, next) => {
  try {
    const allowed = new Set(flowWidgets.filter(widget => hasDashboardWidgetPermission(req.user, widget)));
    const result = {};
    if (!allowed.size) return res.json(result);

    const needsTransactions = ['cash_collected', 'bank_collected', 'cash_paid', 'bank_paid'].some(widget => allowed.has(widget));
    if (needsTransactions) {
      const payments = await db.payment.findAll({
        where: { tenant_id: req.tenantId },
        include: [{ model: db.paymentMethod, attributes: ['method_type'] }],
      });
      const total = (type, cash) => payments
        .filter(item => item.payment_type === type && isCashPayment(item) === cash)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      if (allowed.has('cash_collected')) result.cash_collected = total('incoming', true);
      if (allowed.has('bank_collected')) result.bank_collected = total('incoming', false);
      if (allowed.has('cash_paid')) result.cash_paid = total('outgoing', true);
      if (allowed.has('bank_paid')) result.bank_paid = total('outgoing', false);
    }

    const needsBalances = allowed.has('cash_balance') || allowed.has('bank_balance');
    if (needsBalances) {
      const accounts = await db.account.findAll({
        where: { tenant_id: req.tenantId, is_active: true, type: 'asset' },
        attributes: ['id', 'code', 'parent_id', 'is_group', 'balance'],
      });
      const cashBankGroup = accounts.find(account => account.code === ACCOUNT_CODES.CASH_BANK_GROUP);
      const byId = new Map(accounts.map(account => [account.id, account]));
      const isCashBankLedger = account => {
        if (!account || account.is_group) return false;
        const seen = new Set();
        let current = account;
        while (current?.parent_id) {
          if (current.parent_id === cashBankGroup?.id) return true;
          if (seen.has(current.parent_id)) return false;
          seen.add(current.parent_id);
          current = byId.get(current.parent_id);
        }
        return false;
      };
      const cashBalance = accounts
        .filter(account => isCashBankLedger(account) && account.code === ACCOUNT_CODES.CASH)
        .reduce((sum, account) => sum + Number(account.balance || 0), 0);
      const bankBalance = accounts
        .filter(account => isCashBankLedger(account) && account.code !== ACCOUNT_CODES.CASH)
        .reduce((sum, account) => sum + Number(account.balance || 0), 0);
      if (allowed.has('cash_balance')) result.cash_balance = cashBalance;
      if (allowed.has('bank_balance')) result.bank_balance = bankBalance;
    }

    res.json(result);
  } catch (error) { next(error); }
};
