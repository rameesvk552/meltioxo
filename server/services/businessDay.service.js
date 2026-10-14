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
      attributes: ['amount', 'payment_type', 'payment_method_id', 'journal_entry_id'],
      include: [{ model: db.paymentMethod, attributes: ['id', 'name', 'method_type'] }],
      transaction
    })
  ]);

  const cashMethods = await db.paymentMethod.findAll({
    where: { tenant_id: tenantId, method_type: 'CASH' },
    attributes: ['id', 'account_id', 'name', 'method_type'],
    order: [['sort_order', 'ASC'], ['name', 'ASC']],
    transaction
  });
  const methodByAccount = new Map();
  for (const method of cashMethods) if (!methodByAccount.has(method.account_id)) methodByAccount.set(method.account_id, method);

  const cashJournals = await db.journalEntry.findAll({
    where: { tenant_id: tenantId, business_day_id: businessDayId, status: 'posted' },
    attributes: ['id', 'reference_type'],
    transaction
  });
  // Expenses may be paid from cash held outside the POS drawer. They still
  // affect the Cash ledger, but should not change the drawer reconciliation.
  const cashJournalIds = new Set(cashJournals.filter(entry => entry.reference_type !== 'expense').map(entry => entry.id));
  const cashLines = cashJournalIds.size && methodByAccount.size ? await db.journalEntryLine.findAll({
    where: {
      journal_entry_id: [...cashJournalIds],
      account_id: [...methodByAccount.keys()]
    },
    attributes: ['journal_entry_id', 'account_id', 'debit', 'credit'],
    transaction
  }) : [];

  const methods = new Map();
  for (const payment of payments) {
    const method = payment.paymentMethod;
    // New cash journals are summarized from their posted ledger lines below.
    // Use their payment rows only as a fallback for registers opened before the
    // business-day journal link was introduced.
    if (method?.method_type === 'CASH' && cashJournalIds.has(payment.journal_entry_id)) continue;
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

  const journalMovements = new Map();
  for (const line of cashLines) {
    const method = methodByAccount.get(line.account_id);
    if (!method) continue;
    const key = `${line.journal_entry_id}:${line.account_id}`;
    const current = journalMovements.get(key) || { method, amount: 0 };
    current.amount = money(current.amount + Number(line.debit || 0) - Number(line.credit || 0));
    journalMovements.set(key, current);
  }
  for (const movement of journalMovements.values()) {
    const method = movement.method;
    const key = method.id;
    const current = methods.get(key) || {
      payment_method_id: method.id,
      name: method.name,
      method_type: method.method_type,
      amount: 0,
      count: 0
    };
    current.amount = money(current.amount + movement.amount);
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
