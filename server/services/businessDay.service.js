const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

const BUSINESS_TIME_ZONE = process.env.BUSINESS_TIME_ZONE || 'Asia/Kolkata';
const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const businessDate = (date = new Date(), timeZone = BUSINESS_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const value = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};

const findOpen = (tenantId, transaction, lock = false) => db.businessDay.findOne({
  where: { tenant_id: tenantId, status: 'open' },
  order: [['opened_at', 'DESC']],
  transaction,
  ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {})
});

const requireOpen = async (tenantId, transaction) => {
  const day = await findOpen(tenantId, transaction, true);
  if (!day) throw new AppError('Open the business day before completing this transaction', 409);
  return day;
};

const summarize = async (tenantId, businessDayId, transaction) => {
  const [sales, returns, payments] = await Promise.all([
    db.retailSale.findAll({
      where: { tenant_id: tenantId, business_day_id: businessDayId },
      attributes: ['total_amount', 'cogs_amount'],
      transaction
    }),
    db.salesReturn.findAll({
      where: { tenant_id: tenantId, business_day_id: businessDayId },
      attributes: ['total_amount', 'restocked_cost'],
      transaction
    }),
    db.payment.findAll({
      where: { tenant_id: tenantId, business_day_id: businessDayId },
      attributes: ['amount', 'payment_type', 'payment_method_id'],
      include: [{ model: db.paymentMethod, attributes: ['id', 'name', 'method_type'] }],
      transaction
    })
  ]);

  const methods = new Map();
  for (const payment of payments) {
    const method = payment.paymentMethod;
    const key = payment.payment_method_id || 'unassigned';
    const current = methods.get(key) || {
      payment_method_id: payment.payment_method_id,
      name: method?.name || 'Unassigned',
      method_type: method?.method_type || 'OTHER',
      amount: 0,
      count: 0
    };
    const direction = payment.payment_type === 'outgoing' ? -1 : 1;
    current.amount = money(current.amount + direction * Number(payment.amount || 0));
    current.count += 1;
    methods.set(key, current);
  }

  const paymentSummary = [...methods.values()].sort((a, b) => a.name.localeCompare(b.name));
  const grossSales = money(sales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0));
  const returnTotal = money(returns.reduce((sum, item) => sum + Number(item.total_amount || 0), 0));
  const grossCogs = money(sales.reduce((sum, sale) => sum + Number(sale.cogs_amount || 0), 0));
  const returnedCogs = money(returns.reduce((sum, item) => sum + Number(item.restocked_cost || 0), 0));
  return {
    sales_count: sales.length,
    return_count: returns.length,
    gross_sales: grossSales,
    total_returns: returnTotal,
    total_sales: money(grossSales - returnTotal),
    total_cogs: money(grossCogs - returnedCogs),
    cash_movement: money(paymentSummary.filter(row => row.method_type === 'CASH').reduce((sum, row) => sum + row.amount, 0)),
    payment_summary: paymentSummary
  };
};

module.exports = { BUSINESS_TIME_ZONE, businessDate, findOpen, requireOpen, summarize, money };
