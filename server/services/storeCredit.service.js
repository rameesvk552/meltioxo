const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const accounting = require('./accounting.service');
const { Op } = require('sequelize');
const { ACCOUNT_CODES } = require('../config/constants');

const account = async (tenantId, transaction) => {
  const fallback = await db.account.findOne({ where: { tenant_id: tenantId, code: `SC-${tenantId}` }, transaction });
  const ledger = fallback || await db.account.findOne({ where: { tenant_id: tenantId, code: ACCOUNT_CODES.STORE_CREDIT }, transaction });
  if (!ledger || ledger.name !== 'Customer Store Credit' || ledger.type !== 'liability' || ledger.is_group || !ledger.is_active) {
    throw new AppError('Customer Store Credit ledger is unavailable in the chart of accounts.', 409);
  }
  return ledger;
};

// Lock the customer row before issuing or spending credit. Both paths use the
// same lock, so concurrent tills cannot redeem the same balance twice.
const balance = async (tenantId, customerId, transaction, lock = false) => {
  const customer = await db.customer.findOne({
    where: { id: customerId, tenant_id: tenantId }, transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
  if (!customer) throw new AppError('Customer not found', 404);
  const returns = await db.salesReturn.findAll({
      where: { tenant_id: tenantId, store_credit_amount: { [Op.gt]: 0 } },
      include: [{ model: db.retailSale, required: true, where: { tenant_id: tenantId, customer_id: customerId }, attributes: [] }],
      attributes: ['store_credit_amount'], transaction
    });
  const sales = await db.retailSale.findAll({
      where: { tenant_id: tenantId, customer_id: customerId, store_credit_used: { [Op.gt]: 0 } },
      attributes: ['store_credit_used'], transaction
    });
  return accounting.money(returns.reduce((sum, row) => sum + Number(row.store_credit_amount), 0)
    - sales.reduce((sum, row) => sum + Number(row.store_credit_used), 0));
};

const history = async (tenantId, customerId) => {
  const [returns, sales] = await Promise.all([
    db.salesReturn.findAll({
      where: { tenant_id: tenantId, store_credit_amount: { [Op.gt]: 0 } },
      include: [{ model: db.retailSale, required: true, where: { tenant_id: tenantId, customer_id: customerId }, attributes: ['sale_number'] }],
      attributes: ['id', 'return_number', 'return_date', 'store_credit_amount', 'created_at']
    }),
    db.retailSale.findAll({
      where: { tenant_id: tenantId, customer_id: customerId, store_credit_used: { [Op.gt]: 0 } },
      attributes: ['id', 'sale_number', 'sale_date', 'store_credit_used', 'created_at']
    })
  ]);
  const entries = [
    ...returns.map(row => ({ id: row.id, date: row.return_date, created_at: row.created_at, type: 'issued', reference: row.return_number, related_sale: row.retailSale?.sale_number, amount: Number(row.store_credit_amount) })),
    ...sales.map(row => ({ id: row.id, date: row.sale_date, created_at: row.created_at, type: 'used', reference: row.sale_number, amount: -Number(row.store_credit_used) }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || new Date(a.created_at) - new Date(b.created_at) || (a.type === 'issued' ? -1 : 1));
  let running = 0;
  return entries.map(({ created_at, ...row }) => ({ ...row, balance: (running = accounting.money(running + row.amount)) }));
};

module.exports = { account, balance, history };
