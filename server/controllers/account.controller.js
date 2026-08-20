const db = require('../models');
const { account, journalEntryLine } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');

exports.getAll = async (req, res, next) => {
  try {
    const items = await account.findAll({ where: { tenant_id: req.tenantId }, order: [['code', 'ASC'], ['name', 'ASC']] });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const code = String(req.body.code || '').trim();
    const name = String(req.body.name || '').trim();
    if (!code || !name) throw new AppError('Ledger code and name are required', 400);
    if (!['asset', 'liability', 'equity', 'revenue', 'expense'].includes(req.body.type)) throw new AppError('Select a valid account type', 400);
    if (req.body.parent_id) {
      const parent = await account.findOne({ where: { id: req.body.parent_id, tenant_id: req.tenantId } });
      if (!parent?.is_group) throw new AppError('A ledger must be placed under an account group', 400);
      if (parent.type !== req.body.type) throw new AppError('Ledger type must match its parent group', 400);
    }
    const item = await account.create({ code, name, type: req.body.type, parent_id: req.body.parent_id || null, is_group: Boolean(req.body.is_group), is_active: req.body.is_active !== false, tenant_id: req.tenantId });
    res.status(201).json(item);
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const item = await account.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!item) throw new AppError('Not found', 404);
    const postingCount = await journalEntryLine.count({ where: { account_id: item.id } });
    if (postingCount && (req.body.type !== undefined || req.body.is_group !== undefined || req.body.parent_id !== undefined)) {
      throw new AppError('An account with journal activity cannot change type, group status, or parent', 400);
    }
    if (item.is_system && req.body.is_active === false) throw new AppError('System accounts cannot be disabled', 400);
    const allowed = ['name', 'parent_id', 'is_group', 'is_active', 'type'];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    if (updates.parent_id) {
      const parent = await account.findOne({ where: { id: updates.parent_id, tenant_id: req.tenantId, is_group: true } });
      if (!parent) throw new AppError('Parent account group not found', 400);
    }
    await item.update(updates);
    res.status(200).json(item);
  } catch (error) { next(error); }
};

exports.getLedger = async (req, res, next) => {
  try {
    const ledger = await account.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!ledger) throw new AppError('Ledger not found', 404);
    const lines = await journalEntryLine.findAll({
      where: { account_id: req.params.id },
      include: [{ model: db.journalEntry, where: { tenant_id: req.tenantId, status: 'posted' } }],
      order: [[db.journalEntry, 'entry_date', 'DESC'], ['created_at', 'DESC']]
    });
    res.status(200).json(lines);
  } catch (error) { next(error); }
};

exports.getCashBankLedgers = async (req, res, next) => {
  try {
    res.json(await accounting.getCashBankLedgers(req.tenantId));
  } catch (error) { next(error); }
};

exports.getPaymentMethods = async (req, res, next) => {
  try {
    const activeOnly = req.query.active_only !== 'false';
    res.json(await accounting.listPaymentMethods(req.tenantId, activeOnly));
  } catch (error) { next(error); }
};

exports.createPaymentMethod = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await accounting.createPaymentMethod(req.tenantId, req.body, transaction);
    await transaction.commit();
    res.status(201).json(await accounting.getPaymentMethod(req.tenantId, item.id, null, false));
  } catch (error) { await transaction.rollback(); next(error); }
};

exports.updatePaymentMethod = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await accounting.updatePaymentMethod(req.tenantId, req.params.id, req.body, transaction);
    await transaction.commit();
    res.json(await accounting.getPaymentMethod(req.tenantId, item.id, null, false));
  } catch (error) { await transaction.rollback(); next(error); }
};
