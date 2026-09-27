const db = require('../models');
const { Op } = require('sequelize');
const { ACCOUNT_CODES } = require('../config/constants');
const statements = require('./financialStatements');
const { getAuditContext } = require('../middleware/auditContext');
const { businessDate } = require('./businessDay.service');
const journalScope = tenantId => ({ tenant_id: tenantId, status: 'posted', ...(getAuditContext()?.branchId ? { branch_id: getAuditContext().branchId } : {}) });

exports.trialBalance = async (tenantId, asOfDate, { companyWide = false } = {}) => {
  const scope = companyWide ? { tenant_id: tenantId, status: 'posted', branch_id: { [Op.or]: [{ [Op.ne]: null }, null] } } : journalScope(tenantId);
  const lines = await db.journalEntryLine.findAll({ include: [{ model: db.journalEntry, required: true, where: { ...scope, ...(asOfDate ? { entry_date: { [Op.lte]: asOfDate } } : {}) } }, { model: db.account, required: true, where: { tenant_id: tenantId } }] });
  return statements.trialBalance(lines);
};

exports.whatsappInvoices = async (tenantId, branchId, { from, to, status, page = 1, pageSize = 50 }) => {
  const where = { tenant_id: tenantId };
  if (branchId) where.branch_id = branchId;
  if (status) where.status = status;
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(`${from}T00:00:00.000Z`);
    if (to) {
      const end = new Date(`${to}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      where.created_at[Op.lt] = end;
    }
  }

  const offset = (page - 1) * pageSize;
  const [result, grouped] = await Promise.all([
    db.whatsappInvoiceLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
      raw: true
    }),
    db.whatsappInvoiceLog.findAll({
      where,
      attributes: ['status', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    })
  ]);
  const counts = grouped.reduce((summary, row) => {
    summary[row.status] = Number(row.count || 0);
    return summary;
  }, { sent: 0, failed: 0, skipped: 0, disabled: 0 });
  return {
    summary: { total: result.count, ...counts },
    rows: result.rows,
    pagination: { page, page_size: pageSize, total: result.count }
  };
};

const number = value => Number(value || 0);
const round = value => Math.round((number(value) + Number.EPSILON) * 100) / 100;
const percent = (value, base) => base ? round((value / base) * 100) : 0;
const isoDate = date => date.toISOString().slice(0, 10);

const isCogsAccount = account => {
  const numericCode = Number(account.code);
  return (Number.isInteger(numericCode) && numericCode >= 5100 && numericCode < 5200)
    || account.code === ACCOUNT_CODES.COGS
    || /cost of goods sold|\bcogs\b|direct cost/i.test(account.name || '');
};
const isDiscountAllowedAccount = account => account.code === ACCOUNT_CODES.DISCOUNT_ALLOWED;

const bucketKey = (date, groupBy) => {
  const value = String(date).slice(0, 10);
  if (groupBy === 'year') return value.slice(0, 4);
  if (groupBy === 'month') return value.slice(0, 7);
  return value;
};

const bucketLabel = (key, groupBy) => {
  if (groupBy === 'year') return key;
  if (groupBy === 'month') {
    const [year, month] = key.split('-').map(Number);
    return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]} ${year}`;
  }
  const [, month, day] = key.split('-').map(Number);
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month - 1]}`;
};

const createTrendBuckets = (fromDate, toDate, groupBy) => {
  const buckets = new Map();
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  while (cursor <= end) {
    const key = bucketKey(isoDate(cursor), groupBy);
    if (!buckets.has(key)) buckets.set(key, {
      period: key,
      label: bucketLabel(key, groupBy),
      revenue: 0,
      cogs: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_profit: 0
    });
    if (groupBy === 'year') cursor.setUTCFullYear(cursor.getUTCFullYear() + 1, 0, 1);
    else if (groupBy === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1, 1);
    else cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return buckets;
};

const summarizeFinancialLines = (lines, fromDate, toDate, groupBy) => {
  const revenueAccounts = new Map();
  const cogsAccounts = new Map();
  const expenseAccounts = new Map();
  const trend = createTrendBuckets(fromDate, toDate, groupBy);
  let revenue = 0;
  let cogs = 0;
  let operatingExpenses = 0;

  const addAccount = (map, account, amount) => {
    const current = map.get(account.id) || { id: account.id, code: account.code, name: account.name, amount: 0 };
    current.amount += amount;
    map.set(account.id, current);
  };

  lines.forEach(line => {
    const account = line.account;
    const key = bucketKey(line.journalEntry.entry_date, groupBy);
    const point = trend.get(key);
    if (!account || !point) return;
    if (account.type === 'revenue') {
      const amount = number(line.credit) - number(line.debit);
      revenue += amount;
      point.revenue += amount;
      addAccount(revenueAccounts, account, amount);
    } else {
      const amount = number(line.debit) - number(line.credit);
      if (isDiscountAllowedAccount(account)) {
        revenue -= amount;
        point.revenue -= amount;
        addAccount(revenueAccounts, account, -amount);
      } else if (isCogsAccount(account)) {
        cogs += amount;
        point.cogs += amount;
        addAccount(cogsAccounts, account, amount);
      } else {
        operatingExpenses += amount;
        point.operating_expenses += amount;
        addAccount(expenseAccounts, account, amount);
      }
    }
  });

  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - operatingExpenses;
  const accountRows = map => [...map.values()]
    .map(item => ({ ...item, amount: round(item.amount) }))
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

  return {
    summary: {
      revenue: round(revenue),
      cogs: round(cogs),
      gross_profit: round(grossProfit),
      gross_margin_pct: percent(grossProfit, revenue),
      operating_expenses: round(operatingExpenses),
      net_profit: round(netProfit),
      net_margin_pct: percent(netProfit, revenue),
      break_even_revenue: grossProfit > 0 && revenue > 0 ? round(operatingExpenses / (grossProfit / revenue)) : null
    },
    accounts: {
      revenue: accountRows(revenueAccounts),
      cogs: accountRows(cogsAccounts),
      operating_expenses: accountRows(expenseAccounts)
    },
    trend: [...trend.values()].map(point => {
      const gross = point.revenue - point.cogs;
      return {
        ...point,
        revenue: round(point.revenue),
        cogs: round(point.cogs),
        gross_profit: round(gross),
        operating_expenses: round(point.operating_expenses),
        net_profit: round(gross - point.operating_expenses)
      };
    })
  };
};

const getFinancialLines = (tenantId, fromDate, toDate) => db.journalEntryLine.findAll({
  include: [
    {
      model: db.journalEntry,
      attributes: ['entry_date'],
      where: { ...journalScope(tenantId), entry_date: { [Op.between]: [fromDate, toDate] } },
      required: true
    },
    {
      model: db.account,
      attributes: ['id', 'code', 'name', 'type'],
      where: { tenant_id: tenantId, type: { [Op.in]: ['revenue', 'expense'] } },
      required: true
    }
  ]
});

exports.profitAndLossStatement = async (tenantId, fromDate, toDate) => {
  const lines = await getFinancialLines(tenantId, fromDate, toDate);
  const statement = summarizeFinancialLines(lines, fromDate, toDate, 'month');
  return {
    period: { from: fromDate, to: toDate },
    summary: statement.summary,
    accounts: statement.accounts
  };
};

const productProfitability = (items, returnItems, operatingExpenses) => {
  const products = new Map();
  const variants = new Map();

  const accumulate = (map, key, base, orderId, soldQuantity, revenue, cost) => {
    const row = map.get(key) || { ...base, quantity: 0, revenue: 0, cogs: 0, orders: new Set() };
    row.quantity += soldQuantity;
    row.revenue += revenue;
    row.cogs += cost;
    row.orders.add(orderId);
    map.set(key, row);
  };

  const addTransaction = (item, direction, orderId) => {
    const variant = item.finishedGood;
    const product = variant.product;
    const soldQuantity = direction * number(item.quantity);
    const revenue = direction * (number(item.total) - number(item.tax_amount));
    const cost = direction * number(item.cost_amount);
    const productKey = product?.id || `unassigned:${variant.id}`;
    accumulate(products, productKey, {
      id: productKey,
      product_id: product?.id || null,
      product_name: product?.name || variant.name || 'Unassigned product',
      code: product?.code || variant.sku || '—'
    }, orderId, soldQuantity, revenue, cost);
    accumulate(variants, variant.id, {
      id: variant.id,
      product_id: product?.id || null,
      product_name: product?.name || variant.name || 'Unassigned product',
      variant_name: [variant.size_label, variant.name !== product?.name ? variant.name : null].filter(Boolean).join(' · ') || 'Standard',
      sku: variant.sku || '—'
    }, orderId, soldQuantity, revenue, cost);
  };

  items.forEach(item => addTransaction(item, 1, item.retailSale.id));
  returnItems.forEach(item => addTransaction(item, -1, item.salesReturn.retail_sale_id));

  const totalProductRevenue = [...products.values()].reduce((sum, row) => sum + row.revenue, 0);
  const finalize = row => {
    const grossProfit = row.revenue - row.cogs;
    const allocatedExpenses = totalProductRevenue > 0 ? operatingExpenses * row.revenue / totalProductRevenue : 0;
    const netProfit = grossProfit - allocatedExpenses;
    return {
      ...row,
      orders: row.orders.size,
      quantity: round(row.quantity),
      revenue: round(row.revenue),
      revenue_share_pct: percent(row.revenue, totalProductRevenue),
      cogs: round(row.cogs),
      gross_profit: round(grossProfit),
      gross_margin_pct: percent(grossProfit, row.revenue),
      allocated_expenses: round(allocatedExpenses),
      net_profit: round(netProfit),
      net_margin_pct: percent(netProfit, row.revenue),
      average_selling_price: row.quantity ? round(row.revenue / row.quantity) : 0
    };
  };

  const byProfit = (a, b) => b.net_profit - a.net_profit;
  return {
    total_revenue: round(totalProductRevenue),
    products: [...products.values()].map(finalize).sort(byProfit),
    variants: [...variants.values()].map(finalize).sort(byProfit)
  };
};

const changePct = (current, previous) => previous ? round(((current - previous) / Math.abs(previous)) * 100) : null;

exports.profitAndLoss = async (tenantId, fromDate, toDate, groupBy = 'month') => {
  const start = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);
  const dayCount = Math.floor((end - start) / 86400000) + 1;
  const previousEnd = new Date(start);
  previousEnd.setUTCDate(previousEnd.getUTCDate() - 1);
  const previousStart = new Date(previousEnd);
  previousStart.setUTCDate(previousStart.getUTCDate() - dayCount + 1);
  const previousFrom = isoDate(previousStart);
  const previousTo = isoDate(previousEnd);

  const variantInclude = () => ({
    model: db.finishedGood,
    attributes: ['id', 'sku', 'name', 'size_label'],
    where: { tenant_id: tenantId },
    required: true,
    include: [{ model: db.product, attributes: ['id', 'code', 'name'], required: false }]
  });
  const itemInclude = [
    {
      model: db.retailSale,
      attributes: ['id', 'sale_date'],
      where: { tenant_id: tenantId, sale_date: { [Op.between]: [fromDate, toDate] } },
      required: true
    },
    variantInclude()
  ];

  const [currentLines, previousLines, sales, previousSales, saleItems, returnedItems] = await Promise.all([
    getFinancialLines(tenantId, fromDate, toDate),
    getFinancialLines(tenantId, previousFrom, previousTo),
    db.retailSale.findAll({
      where: { tenant_id: tenantId, sale_date: { [Op.between]: [fromDate, toDate] } },
      attributes: ['id', 'subtotal', 'discount_amount', 'total_amount']
    }),
    db.retailSale.findAll({
      where: { tenant_id: tenantId, sale_date: { [Op.between]: [previousFrom, previousTo] } },
      attributes: ['id', 'subtotal', 'discount_amount', 'total_amount']
    }),
    db.retailSaleItem.findAll({
      attributes: ['quantity', 'total', 'tax_amount', 'cost_amount'],
      include: itemInclude
    }),
    db.salesReturnItem.findAll({
      attributes: ['quantity', 'total', 'tax_amount', 'cost_amount'],
      include: [
        {
          model: db.salesReturn,
          attributes: ['retail_sale_id'],
          where: { tenant_id: tenantId, return_date: { [Op.between]: [fromDate, toDate] } },
          required: true
        },
        variantInclude()
      ]
    })
  ]);

  const current = summarizeFinancialLines(currentLines, fromDate, toDate, groupBy);
  const previous = summarizeFinancialLines(previousLines, previousFrom, previousTo, groupBy).summary;
  const productReport = productProfitability(saleItems, returnedItems, current.summary.operating_expenses);
  const salesRevenue = rows => rows.reduce((sum, sale) => sum + number(sale.subtotal) - number(sale.discount_amount), 0);
  const currentSalesRevenue = salesRevenue(sales);
  const previousSalesRevenue = salesRevenue(previousSales);
  current.summary.orders = sales.length;
  current.summary.average_order_value = sales.length ? round(currentSalesRevenue / sales.length) : 0;

  const bestProduct = productReport.products[0] || null;
  const lossProducts = productReport.products.filter(row => row.net_profit < 0);
  const lowMarginProducts = productReport.products.filter(row => row.revenue > 0 && row.gross_margin_pct < 20);

  return {
    period: { from: fromDate, to: toDate, group_by: groupBy, previous_from: previousFrom, previous_to: previousTo },
    summary: current.summary,
    comparison: {
      previous: {
        ...previous,
        orders: previousSales.length,
        average_order_value: previousSales.length ? round(previousSalesRevenue / previousSales.length) : 0
      },
      changes: {
        revenue_pct: changePct(current.summary.revenue, previous.revenue),
        gross_profit_pct: changePct(current.summary.gross_profit, previous.gross_profit),
        operating_expenses_pct: changePct(current.summary.operating_expenses, previous.operating_expenses),
        net_profit_pct: changePct(current.summary.net_profit, previous.net_profit),
        orders_pct: changePct(sales.length, previousSales.length)
      }
    },
    trend: current.trend,
    accounts: current.accounts,
    product_profitability: {
      ...productReport,
      allocation_method: 'Operating expenses are allocated in proportion to product sales revenue.',
      unreconciled_sales_revenue: round(current.summary.revenue - productReport.total_revenue)
    },
    owner_signals: {
      best_product: bestProduct ? { id: bestProduct.id, name: bestProduct.product_name, net_profit: bestProduct.net_profit, margin_pct: bestProduct.net_margin_pct } : null,
      loss_products: lossProducts.length,
      low_margin_products: lowMarginProducts.length,
      profitable: current.summary.net_profit >= 0
    },
    // Backward-compatible fields for any older clients consuming this endpoint.
    revenue: current.summary.revenue,
    expense: round(current.summary.cogs + current.summary.operating_expenses),
    net_profit: current.summary.net_profit,
    cogs: current.summary.cogs
  };
};

exports.balanceSheet = async (tenantId, asOfDate) => {
  return { as_of: asOfDate || isoDate(new Date()), ...statements.balanceSheet(await exports.trialBalance(tenantId, asOfDate)) };
};

exports.ledgerStatement = async (tenantId, accountId, from, to) => {
  const account = await db.account.findOne({ where: { id: accountId, tenant_id: tenantId } });
  if (!account || account.is_group) {
    const { AppError } = require('../middleware/errorHandler');
    throw new AppError('Choose a posting ledger', 404);
  }
  const lines = await db.journalEntryLine.findAll({ where: { account_id: accountId }, include: [{
    model: db.journalEntry, required: true, where: { ...journalScope(tenantId), entry_date: { [Op.lte]: to } }
  }] });
  return { account: { id: account.id, code: account.code, name: account.name, type: account.type }, period: { from, to }, ...statements.ledgerStatement(lines, account.type, from, to) };
};

exports.managementReport = async (tenantId, from, to) => {
  const lines = await getFinancialLines(tenantId, from, to);
  return { period: { from, to }, ...summarizeFinancialLines(lines, from, to, 'month') };
};

exports.accountingHealth = async (tenantId, branchId) => {
  const [journals, accounts, balances] = await Promise.all([
    db.journalEntry.findAll({ where: { ...journalScope(tenantId), ...(branchId ? { branch_id: branchId } : {}) }, include: [db.journalEntryLine] }),
    db.account.findAll({ where: { tenant_id: tenantId }, attributes: ['id', 'code', 'name', 'type', 'balance', 'is_group'] }),
    exports.trialBalance(tenantId)
  ]);
  const companyBalances = branchId ? await exports.trialBalance(tenantId, undefined, { companyWide: true }) : balances;
  const actual = new Map(companyBalances.map(row => [row.id, row.balance]));
  const mismatches = accounts.filter(row => statements.cents(row.balance) !== statements.cents(actual.get(row.id) || 0))
    .map(row => ({ id: row.id, code: row.code, name: row.name, stored: Number(row.balance), posted: actual.get(row.id) || 0 }));
  const unbalanced = [], headerMismatches = [];
  for (const journal of journals) {
    const debit = (journal.journalEntryLines || []).reduce((sum, line) => sum + statements.cents(line.debit), 0);
    const credit = (journal.journalEntryLines || []).reduce((sum, line) => sum + statements.cents(line.credit), 0);
    const row = { id: journal.id, reference: journal.entry_number, date: journal.entry_date, debit: debit / 100, credit: credit / 100 };
    if (debit !== credit) unbalanced.push(row);
    if (debit !== statements.cents(journal.total_debit) || credit !== statements.cents(journal.total_credit)) headerMismatches.push(row);
  }
  const debit = balances.reduce((sum, row) => sum + statements.cents(row.debit), 0) / 100;
  const credit = balances.reduce((sum, row) => sum + statements.cents(row.credit), 0) / 100;
  return { posted_journals: journals.length, total_debit: debit, total_credit: credit, difference: round(debit-credit),
    balanced: statements.cents(debit) === statements.cents(credit) && unbalanced.length === 0 && headerMismatches.length === 0, stored_balance_check: 'checked_company',
    stored_balance_mismatches: mismatches, unbalanced_journals: unbalanced, header_mismatches: headerMismatches };
};

exports.agingReport = async (tenantId, type) => {
  const isPayable = type === 'payable';
  const Model = isPayable ? db.purchaseInvoice : db.salesInvoice;
  const Party = isPayable ? db.supplier : db.customer;
  const invoices = await Model.findAll({
    where: { tenant_id: tenantId, status: { [Op.in]: ['unpaid', 'partial', 'overdue'] } },
    include: [Party], order: [['due_date', 'ASC']]
  });
  const now = new Date(`${businessDate()}T00:00:00Z`);
  const report = { current: 0, '1-30': 0, '31-60': 0, '60+': 0, invoices: [] };
  for (const invoice of invoices) {
    const balance = Math.max(0, round(Number(invoice.total_amount || 0) - Number(invoice.paid_amount || 0)));
    if (!balance) continue;
    const due = new Date(`${invoice.due_date || businessDate()}T00:00:00Z`);
    const daysOverdue = Math.max(0, Math.floor((now - due) / 86400000));
    const bucket = daysOverdue === 0 ? 'current' : daysOverdue <= 30 ? '1-30' : daysOverdue <= 60 ? '31-60' : '60+';
    report[bucket] = round(report[bucket] + balance);
    const party = invoice[isPayable ? 'supplier' : 'customer'];
    report.invoices.push({
      id: invoice.invoice_number, invoice_id: invoice.id,
      party_id: invoice[isPayable ? 'supplier_id' : 'customer_id'],
      [isPayable ? 'supplier' : 'customer']: party?.name || 'Unknown',
      due: invoice.due_date, amount: Number(invoice.total_amount || 0), balance,
      daysOverdue, status: bucket === 'current' ? 'Current' : `${bucket} Days`
    });
  }
  return report;
};

exports.cashFlow = async (tenantId, fromDate, toDate) => {
  const accounting = require('./accounting.service');
  const ledgers = await accounting.getCashBankLedgers(tenantId, undefined, { includeInactive: true });
  const lines = ledgers.length ? await db.journalEntryLine.findAll({
    where: { account_id: { [Op.in]: ledgers.map(row => row.id) } },
    include: [{ model: db.journalEntry, required: true, where: { ...journalScope(tenantId), entry_date: { [Op.lte]: toDate } } }, { model: db.account, required: true, where: { tenant_id: tenantId } }]
  }) : [];
  return { period: { from: fromDate, to: toDate }, ...statements.cashMovements(lines, fromDate, toDate) };
};
