const { Op } = require('sequelize');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const { ACCOUNT_CODES } = require('../config/constants');

const PAYMENT_METHOD_TYPES = ['CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'];
const ACCOUNT_TYPE_BASES = { asset: 1000, liability: 2000, equity: 3000, revenue: 4000, expense: 5000 };
const today = () => new Date().toISOString().slice(0, 10);

const supplierLedgerName = supplier => `Vendor - ${String(supplier.name || '').trim()}`;

const ensureSupplierLedger = async (tenantId, supplier, transaction) => {
  const creditors = await db.account.findOne({ where: { tenant_id: tenantId, code: ACCOUNT_CODES.AP }, transaction });
  if (!creditors) throw new AppError('Trade Creditors ledger is not configured', 500);
  if (!creditors.is_group) await creditors.update({ is_group: true }, { transaction });
  let ledger = await db.account.findOne({ where: { tenant_id: tenantId, supplier_id: supplier.id }, transaction, lock: transaction?.LOCK?.UPDATE });
  if (!ledger) {
    const code = await generateNextAccountCode(tenantId, creditors, 'liability', transaction);
    ledger = await db.account.create({ tenant_id: tenantId, code, name: supplierLedgerName(supplier), supplier_id: supplier.id, type: 'liability', parent_id: creditors.id, is_group: false, is_system: false, is_active: true }, { transaction });
  } else if (ledger.name !== supplierLedgerName(supplier) || ledger.parent_id !== creditors.id || ledger.type !== 'liability') {
    await ledger.update({ name: supplierLedgerName(supplier), parent_id: creditors.id, type: 'liability', is_group: false, is_active: true }, { transaction });
  }
  return ledger;
};

const ensureSupplierLedgers = async (tenantId, transaction) => {
  const suppliers = await db.supplier.findAll({ where: { tenant_id: tenantId }, transaction, order: [['created_at', 'ASC']] });
  const ledgers = [];
  for (const supplier of suppliers) ledgers.push(await ensureSupplierLedger(tenantId, supplier, transaction));
  return ledgers;
};

const getSupplierLedger = async (tenantId, supplierId, transaction) => {
  const supplier = await db.supplier.findOne({ where: { id: supplierId, tenant_id: tenantId }, transaction });
  if (!supplier) throw new AppError('Supplier not found', 404);
  return ensureSupplierLedger(tenantId, supplier, transaction);
};

const money = (value, field = 'Amount') => {
  const numeric = Number(value || 0);
  if (!Number.isFinite(numeric)) throw new AppError(`${field} must be a valid number`, 400);
  return Math.round((numeric + Number.EPSILON) * 100) / 100;
};

const dateOnly = value => {
  const result = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : value ? String(value).slice(0, 10) : today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new AppError('Entry date must be YYYY-MM-DD', 400);
  return result;
};

const accountCodeRange = (parentCode, type) => {
  const match = String(parentCode || '').toUpperCase().match(/^G?(\d{4})$/);
  if (match) {
    const parentNumber = Number(match[1]);
    const base = String(parentCode).toUpperCase().startsWith('G') && parentNumber % 100 === 0
      ? parentNumber
      : Math.floor(parentNumber / 100) * 100;
    return { start: base + 1, end: base + 99 };
  }
  const base = ACCOUNT_TYPE_BASES[type] || 9000;
  return { start: base + 1, end: base + 999 };
};

const generateNextAccountCode = async (tenantId, parent, type, transaction) => {
  const { start, end } = accountCodeRange(parent?.code, type);
  const rows = await db.account.findAll({ where: { tenant_id: tenantId }, attributes: ['code'], transaction });
  const used = new Set(rows.map(row => String(row.code)).filter(code => /^\d{4}$/.test(code)).map(Number));
  const inRange = [...used].filter(code => code >= start && code <= end);
  let candidate = inRange.length ? Math.max(...inRange) + 1 : start;
  if (candidate > end) {
    candidate = start;
    while (candidate <= end && used.has(candidate)) candidate += 1;
  }
  if (candidate > end) throw new AppError('No account codes are available under this group', 409);
  return String(candidate).padStart(4, '0');
};

const normalizePaymentMethodType = value => {
  const type = String(value || '').trim().toUpperCase();
  if (!PAYMENT_METHOD_TYPES.includes(type)) throw new AppError('Invalid payment method type', 400);
  return type;
};

const paymentModeForType = type => ({ CASH: 'cash', BANK: 'bank_transfer', UPI: 'upi', CARD: 'card', WALLET: 'wallet', GATEWAY: 'gateway', OTHER: 'other' }[type] || 'other');

const validateJournalLines = lines => {
  if (!Array.isArray(lines) || lines.length < 2) throw new AppError('A journal entry requires at least two lines', 400);
  let debitCents = 0;
  let creditCents = 0;
  const normalized = lines.map((line, index) => {
    if (!line.account_id) throw new AppError(`Journal line ${index + 1} requires an account`, 400);
    const debit = money(line.debit_amount ?? line.debit, 'Debit amount');
    const credit = money(line.credit_amount ?? line.credit, 'Credit amount');
    if (debit < 0 || credit < 0 || (debit > 0 && credit > 0) || (!debit && !credit)) {
      throw new AppError(`Journal line ${index + 1} must contain either a debit or a credit`, 400);
    }
    debitCents += Math.round(debit * 100);
    creditCents += Math.round(credit * 100);
    return { account_id: line.account_id, description: line.description || null, debit, credit };
  });
  if (debitCents !== creditCents) throw new AppError(`Unbalanced journal entry: debits ${(debitCents / 100).toFixed(2)} must equal credits ${(creditCents / 100).toFixed(2)}`, 400);
  if (!debitCents) throw new AppError('Journal total must be greater than zero', 400);
  return { lines: normalized, totalDebit: debitCents / 100, totalCredit: creditCents / 100 };
};

const validatePostingAccounts = async (tenantId, lines, transaction) => {
  const ids = [...new Set(lines.map(line => line.account_id))];
  const accounts = await db.account.findAll({ where: { tenant_id: tenantId, id: { [Op.in]: ids }, is_active: true }, transaction, lock: transaction?.LOCK?.UPDATE });
  if (accounts.length !== ids.length) throw new AppError('One or more posting accounts are invalid or inactive', 400);
  const group = accounts.find(account => account.is_group);
  if (group) throw new AppError(`${group.name} is an account group and cannot receive postings`, 400);
  return new Map(accounts.map(account => [account.id, account]));
};

const generateAutoNumber = async (tenantId, prefix, transaction) => {
  if (transaction && db.sequelize.getDialect() === 'postgres') {
    await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:sequence_key))', { replacements: { sequence_key: `${tenantId}:journal-number` }, transaction });
  }
  const year = new Date().getFullYear();
  const count = await db.journalEntry.count({ where: { tenant_id: tenantId }, transaction });
  return `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`;
};

const createJournalEntry = async (tenantId, data, transaction) => {
  const entryDate = dateOnly(data.entry_date);
  if (entryDate > today()) throw new AppError('Future-dated journal entries are not allowed', 400);
  const validated = validateJournalLines(data.lines);
  await validatePostingAccounts(tenantId, validated.lines, transaction);
  const journalEntry = await db.journalEntry.create({
    tenant_id: tenantId,
    entry_number: await generateAutoNumber(tenantId, 'JE', transaction),
    entry_date: entryDate,
    reference_type: data.reference_type || 'manual_journal',
    reference_id: data.reference_id || null,
    narration: String(data.narration || '').trim() || 'Journal entry',
    total_debit: validated.totalDebit,
    total_credit: validated.totalCredit,
    created_by: data.created_by || null,
    status: 'draft'
  }, { transaction });
  await db.journalEntryLine.bulkCreate(validated.lines.map(line => ({ journal_entry_id: journalEntry.id, account_id: line.account_id, description: line.description, debit: line.debit, credit: line.credit })), { transaction });
  return journalEntry;
};

const postJournal = async (tenantId, journalId, userId, transaction) => {
  // Lock the journal row separately. PostgreSQL cannot apply FOR UPDATE to the
  // nullable side of Sequelize's outer join when lines are eager-loaded.
  const journal = await db.journalEntry.findOne({ where: { id: journalId, tenant_id: tenantId }, transaction, lock: transaction?.LOCK?.UPDATE });
  if (!journal) throw new AppError('Journal entry not found', 404);
  if (journal.status === 'posted') return journal;
  const journalLines = await db.journalEntryLine.findAll({ where: { journal_entry_id: journal.id }, transaction });
  const validated = validateJournalLines(journalLines.map(line => ({ account_id: line.account_id, debit: line.debit, credit: line.credit, description: line.description })));
  const accounts = await validatePostingAccounts(tenantId, validated.lines, transaction);
  for (const line of validated.lines) {
    const account = accounts.get(line.account_id);
    const change = ['asset', 'expense'].includes(account.type) ? line.debit - line.credit : line.credit - line.debit;
    await account.increment('balance', { by: change, transaction });
  }
  await journal.update({ status: 'posted', posted_by: userId || null }, { transaction });
  return journal;
};

const getAccountsByCode = async (tenantId, codes, transaction) => {
  const accounts = await db.account.findAll({ where: { tenant_id: tenantId, code: { [Op.in]: codes }, is_active: true }, transaction });
  const byCode = Object.fromEntries(accounts.map(account => [account.code, account]));
  const missing = codes.filter(code => !byCode[code]);
  if (missing.length) throw new AppError(`Missing system account(s): ${missing.join(', ')}`, 500);
  return byCode;
};

const createAndPost = async (tenantId, data, userId, transaction) => {
  if (data.reference_type && data.reference_id) {
    const existing = await db.journalEntry.findOne({ where: { tenant_id: tenantId, reference_type: data.reference_type, reference_id: data.reference_id }, transaction, lock: transaction?.LOCK?.UPDATE });
    if (existing) return existing.status === 'draft' ? postJournal(tenantId, existing.id, userId, transaction) : existing;
  }
  const journal = await createJournalEntry(tenantId, { ...data, created_by: userId }, transaction);
  return postJournal(tenantId, journal.id, userId, transaction);
};

const getCashBankLedgers = async (tenantId, transaction) => {
  const all = await db.account.findAll({ where: { tenant_id: tenantId, is_active: true, type: 'asset' }, order: [['code', 'ASC'], ['name', 'ASC']], transaction });
  const root = all.find(account => account.code === ACCOUNT_CODES.CASH_BANK_GROUP);
  if (!root) throw new AppError('Cash & Bank group is not configured', 500);
  const byId = new Map(all.map(account => [account.id, account]));
  const isDescendant = account => {
    const seen = new Set();
    let current = account;
    while (current?.parent_id) {
      if (current.parent_id === root.id) return true;
      if (seen.has(current.parent_id)) return false;
      seen.add(current.parent_id);
      current = byId.get(current.parent_id);
    }
    return false;
  };
  return all.filter(account => !account.is_group && isDescendant(account));
};

const assertCashBankLedger = async (tenantId, accountId, transaction) => {
  const ledger = (await getCashBankLedgers(tenantId, transaction)).find(row => row.id === accountId);
  if (!ledger) throw new AppError('Payment method must use an active leaf ledger under Cash & Bank', 400);
  return ledger;
};

const ensureDefaultPaymentMethods = async (tenantId, transaction) => {
  const ledgers = await getCashBankLedgers(tenantId, transaction);
  // Travel Bot creates only Cash. Other methods are tenant-owned and are added
  // after the matching real-world ledger is created under Cash & Bank.
  const defaults = [[ACCOUNT_CODES.CASH, 'Cash', 'CASH', 10, true]];
  for (const [code, name, type, sortOrder, isDefault] of defaults) {
    const ledger = ledgers.find(item => item.code === code);
    if (!ledger) continue;
    const existing = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, name }, transaction });
    if (!existing) await db.paymentMethod.create({ tenant_id: tenantId, account_id: ledger.id, name, method_type: type, sort_order: sortOrder, is_default: isDefault }, { transaction });
  }
  const activeDefault = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, is_active: true, is_default: true }, transaction });
  if (!activeDefault) {
    const first = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, is_active: true }, order: [['sort_order', 'ASC'], ['created_at', 'ASC']], transaction });
    if (first) await first.update({ is_default: true }, { transaction });
  }
};

const listPaymentMethods = async (tenantId, activeOnly = true, transaction) => {
  await ensureDefaultPaymentMethods(tenantId, transaction);
  return db.paymentMethod.findAll({ where: { tenant_id: tenantId, ...(activeOnly ? { is_active: true } : {}) }, include: [db.account], order: [['sort_order', 'ASC'], ['name', 'ASC']], transaction });
};

const getPaymentMethod = async (tenantId, id, transaction, activeOnly = true) => {
  const method = await db.paymentMethod.findOne({ where: { id, tenant_id: tenantId, ...(activeOnly ? { is_active: true } : {}) }, include: [db.account], transaction });
  if (!method) throw new AppError('Payment method not found', 404);
  return method;
};

const resolvePaymentMethod = async (tenantId, payload = {}, transaction) => {
  await ensureDefaultPaymentMethods(tenantId, transaction);
  if (payload.payment_method_id) return getPaymentMethod(tenantId, payload.payment_method_id, transaction);
  if (payload.bank_account_id) {
    const ledger = await assertCashBankLedger(tenantId, payload.bank_account_id, transaction);
    const byLedger = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, account_id: ledger.id, is_active: true }, include: [db.account], transaction });
    if (byLedger) return byLedger;
  }
  const requestedType = String(payload.payment_mode || '').toUpperCase().replace('BANK_TRANSFER', 'BANK');
  if (PAYMENT_METHOD_TYPES.includes(requestedType)) {
    const byType = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, method_type: requestedType, is_active: true }, include: [db.account], order: [['is_default', 'DESC'], ['sort_order', 'ASC']], transaction });
    if (byType) return byType;
  }
  const fallback = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, is_active: true }, include: [db.account], order: [['is_default', 'DESC'], ['sort_order', 'ASC']], transaction });
  if (!fallback) throw new AppError('Configure an active payment method before recording money movements', 400);
  return fallback;
};

// Split payments are validated in cents so Cash + UPI + Card always matches
// the document total exactly. A missing payments array keeps older clients
// compatible with the original single payment_method_id payload.
const normalizePaymentSplits = (payload = {}, totalAmount) => {
  if (!Array.isArray(payload.payments)) return null;
  if (!payload.payments.length) throw new AppError('Add at least one payment', 400);
  const seen = new Set();
  const splits = payload.payments.map((row, index) => {
    const paymentMethodId = String(row.payment_method_id || '').trim();
    if (!paymentMethodId) throw new AppError(`Payment ${index + 1} requires a payment method`, 400);
    if (seen.has(paymentMethodId)) throw new AppError('Use each payment method only once per transaction', 400);
    seen.add(paymentMethodId);
    const amount = money(row.amount, `Payment ${index + 1} amount`);
    if (amount <= 0) throw new AppError(`Payment ${index + 1} amount must be greater than zero`, 400);
    return { payment_method_id: paymentMethodId, amount };
  });
  const paidCents = splits.reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const totalCents = Math.round(money(totalAmount, 'Document total') * 100);
  if (paidCents !== totalCents) {
    throw new AppError(`Payment total ${(paidCents / 100).toFixed(2)} must equal document total ${(totalCents / 100).toFixed(2)}`, 400);
  }
  return splits;
};

const resolvePaymentSplits = async (tenantId, payload = {}, totalAmount, transaction) => {
  const splits = normalizePaymentSplits(payload, totalAmount);
  if (!splits) {
    const method = await resolvePaymentMethod(tenantId, payload, transaction);
    return [{ method, amount: money(totalAmount) }];
  }
  const resolved = [];
  for (const split of splits) {
    resolved.push({ method: await getPaymentMethod(tenantId, split.payment_method_id, transaction), amount: split.amount });
  }
  return resolved;
};

const createPaymentMethod = async (tenantId, payload, transaction) => {
  const name = String(payload.name || '').trim();
  if (!name) throw new AppError('Payment method name is required', 400);
  const duplicate = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, name }, transaction });
  if (duplicate) throw new AppError('A payment method with this name already exists', 409);
  const ledger = await assertCashBankLedger(tenantId, payload.account_id, transaction);
  if (payload.is_default) await db.paymentMethod.update({ is_default: false }, { where: { tenant_id: tenantId }, transaction });
  const method = await db.paymentMethod.create({ tenant_id: tenantId, account_id: ledger.id, name, method_type: normalizePaymentMethodType(payload.method_type), is_default: Boolean(payload.is_default), is_active: payload.is_active !== false, sort_order: Number.isInteger(payload.sort_order) ? payload.sort_order : 0 }, { transaction });
  const defaultCount = await db.paymentMethod.count({ where: { tenant_id: tenantId, is_active: true, is_default: true }, transaction });
  if (!defaultCount && method.is_active) await method.update({ is_default: true }, { transaction });
  return method;
};

const updatePaymentMethod = async (tenantId, id, payload, transaction) => {
  const method = await getPaymentMethod(tenantId, id, transaction, false);
  const updates = {};
  if (payload.account_id !== undefined) updates.account_id = (await assertCashBankLedger(tenantId, payload.account_id, transaction)).id;
  if (payload.name !== undefined) {
    updates.name = String(payload.name).trim();
    if (!updates.name) throw new AppError('Payment method name is required', 400);
    const duplicate = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, name: updates.name, id: { [Op.ne]: id } }, transaction });
    if (duplicate) throw new AppError('A payment method with this name already exists', 409);
  }
  if (payload.method_type !== undefined) updates.method_type = normalizePaymentMethodType(payload.method_type);
  if (payload.is_default !== undefined) updates.is_default = Boolean(payload.is_default);
  if (payload.is_active !== undefined) updates.is_active = Boolean(payload.is_active);
  if (payload.sort_order !== undefined) updates.sort_order = Number(payload.sort_order) || 0;
  if (updates.is_default) { await db.paymentMethod.update({ is_default: false }, { where: { tenant_id: tenantId }, transaction }); updates.is_active = true; }
  await method.update(updates, { transaction });
  const activeDefault = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, is_active: true, is_default: true }, transaction });
  if (!activeDefault) {
    const first = await db.paymentMethod.findOne({ where: { tenant_id: tenantId, is_active: true }, order: [['sort_order', 'ASC']], transaction });
    if (first) await first.update({ is_default: true }, { transaction });
  }
  return method;
};

const reverseJournal = async (tenantId, journalId, userId, reversalDate, narration, transaction) => {
  const original = await db.journalEntry.findOne({ where: { id: journalId, tenant_id: tenantId }, transaction, lock: transaction?.LOCK?.UPDATE });
  if (!original) throw new AppError('Journal entry not found', 404);
  if (original.status !== 'posted') throw new AppError('Only posted journals can be reversed', 400);
  if (original.reversed_by_id) return db.journalEntry.findOne({ where: { id: original.reversed_by_id, tenant_id: tenantId }, transaction });
  const originalLines = await db.journalEntryLine.findAll({ where: { journal_entry_id: original.id }, transaction });
  const reversal = await createAndPost(tenantId, { entry_date: reversalDate || today(), reference_type: 'journal_reversal', reference_id: original.id, narration: narration || `Reversal of ${original.entry_number}`, lines: originalLines.map(line => ({ account_id: line.account_id, debit_amount: line.credit, credit_amount: line.debit, description: `Reversal: ${line.description || ''}` })) }, userId, transaction);
  await original.update({ reversed_by_id: reversal.id }, { transaction });
  await reversal.update({ reversal_of_id: original.id }, { transaction });
  return reversal;
};

module.exports = { PAYMENT_METHOD_TYPES, accountCodeRange, generateNextAccountCode, money, paymentModeForType, validateJournalLines, createJournalEntry, postJournal, generateAutoNumber, getAccountsByCode, createAndPost, getCashBankLedgers, assertCashBankLedger, ensureDefaultPaymentMethods, listPaymentMethods, getPaymentMethod, resolvePaymentMethod, normalizePaymentSplits, resolvePaymentSplits, createPaymentMethod, updatePaymentMethod, reverseJournal, ensureSupplierLedger, ensureSupplierLedgers, getSupplierLedger };
