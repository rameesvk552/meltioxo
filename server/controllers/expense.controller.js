const db = require('../models');
const { expense } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');

exports.getAll = async (req, res, next) => {
  try {
    const items = await expense.findAll({ where: { tenant_id: req.tenantId }, include: [db.paymentMethod], order: [['expense_date', 'DESC'], ['created_at', 'DESC']] });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const amount = accounting.money(req.body.amount, 'Expense amount');
    if (amount <= 0) throw new AppError('Expense amount must be greater than zero', 400);
    if (String(req.body.expense_date || '').slice(0, 10) > new Date().toISOString().slice(0, 10)) throw new AppError('Future-dated expenses are not allowed', 400);
    const costAccount = await db.account.findOne({ where: { id: req.body.account_id, tenant_id: req.tenantId, type: 'expense', is_active: true, is_group: false }, transaction });
    if (!costAccount) throw new AppError('Select an active expense ledger', 400);
    const method = await accounting.resolvePaymentMethod(req.tenantId, req.body, transaction);
    const sequence = await expense.count({ where: { tenant_id: req.tenantId }, transaction }) + 1;
    const item = await expense.create({ ...req.body, tenant_id: req.tenantId, amount,
      expense_number: req.body.expense_number || `EXP-${new Date(req.body.expense_date).getFullYear()}-${String(sequence).padStart(4, '0')}`,
      payment_method_id: method.id, payment_mode: accounting.paymentModeForType(method.method_type),
      bank_account_id: method.account.id, created_by: req.user.id }, { transaction });
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) { await transaction.rollback(); next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const [updated] = await expense.update(req.body, { where: { id: req.params.id, tenant_id: req.tenantId, status: 'draft' } });
    if (!updated) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.approve = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await expense.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw new AppError('Expense not found', 404);
    if (item.status !== 'draft') throw new AppError('Only draft expenses can be approved', 400);
    const costAccount = await db.account.findOne({ where: { id: item.account_id, tenant_id: req.tenantId, type: 'expense', is_active: true }, transaction });
    const method = await accounting.resolvePaymentMethod(req.tenantId, item, transaction);
    const paymentLedger = method.account;
    if (!costAccount) throw new AppError('Select an active expense ledger', 400);
    const journal = await accounting.createAndPost(req.tenantId, { entry_date: item.expense_date, reference_type: 'expense', reference_id: item.id,
      narration: item.description || `Expense ${item.expense_number}`, lines: [
        { account_id: costAccount.id, debit_amount: item.amount, description: item.description },
        { account_id: paymentLedger.id, credit_amount: item.amount, description: item.description }
      ] }, req.user.id, transaction);
    await item.update({ status: 'approved', approved_by: req.user.id, journal_entry_id: journal.id }, { transaction });
    await transaction.commit();
    res.json(item);
  } catch (error) { await transaction.rollback(); next(error); }
};
