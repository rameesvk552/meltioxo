const db = require('../models');
const { journalEntry, journalEntryLine } = db;
const { AppError } = require('../middleware/errorHandler');
const accountingService = require('../services/accounting.service');

exports.getAll = async (req, res, next) => {
  try {
    const items = await journalEntry.findAll({ where: { tenant_id: req.tenantId }, order: [['entry_date', 'DESC'], ['created_at', 'DESC']] });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await journalEntry.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [{ model: journalEntryLine, include: [{ model: db.account, where: { tenant_id: req.tenantId }, required: false }] }] });
    if (!item) throw new AppError('Not found', 404);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await accountingService.createJournalEntry(
      req.tenantId,
      { ...req.body, created_by: req.user.id },
      transaction
    );
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.createLiabilityPayment = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const amount = accountingService.money(req.body.amount, 'Payment amount');
    if (amount <= 0) throw new AppError('Payment amount must be greater than zero', 400);
    const liabilityAccount = await db.account.findOne({
      where: { id: req.body.liability_account_id, tenant_id: req.tenantId, type: 'liability', is_active: true, is_group: false },
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!liabilityAccount) throw new AppError('Select an active liability ledger', 400);

    const method = await accountingService.resolvePaymentMethod(req.tenantId, { payment_method_id: req.body.payment_method_id }, transaction);
    const paymentAccount = method.account;
    if (!paymentAccount || paymentAccount.tenant_id !== req.tenantId || paymentAccount.type !== 'asset' || paymentAccount.is_group || !paymentAccount.is_active) {
      throw new AppError('Select a valid cash or bank payment method', 400);
    }

    const item = await accountingService.createJournalEntry(req.tenantId, {
      entry_date: req.body.payment_date,
      reference_type: 'liability_payment',
      narration: req.body.narration,
      branch_id: req.branchId,
      created_by: req.user.id,
      lines: [
        { account_id: liabilityAccount.id, debit_amount: amount, description: req.body.narration },
        { account_id: paymentAccount.id, credit_amount: amount, description: req.body.narration }
      ]
    }, transaction);
    await accountingService.postJournal(req.tenantId, item.id, req.user.id, transaction);
    await transaction.commit();
    res.status(201).json({ id: item.id, entry_number: item.entry_number, status: 'posted' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.post = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await accountingService.postJournal(req.tenantId, req.params.id, req.user.id, transaction);
    await transaction.commit();
    res.json(item);
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.reverse = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await accountingService.reverseJournal(req.tenantId, req.params.id, req.user.id, req.body.entry_date, req.body.narration, transaction);
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) { await transaction.rollback(); next(error); }
};
