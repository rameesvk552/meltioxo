const db = require('../models');
const { supplier, purchaseOrder, purchaseInvoice, account, journalEntryLine } = db;
const { AppError } = require('../middleware/errorHandler');
const accounting = require('../services/accounting.service');

exports.getAll = async (req, res, next) => {
  try {
    const suppliers = await supplier.findAll({ where: { tenant_id: req.tenantId } });
    const ledgers = await account.findAll({ where: { tenant_id: req.tenantId, supplier_id: suppliers.map(item => item.id) } });
    const bySupplier = new Map(ledgers.map(item => [item.supplier_id, item]));
    res.status(200).json(suppliers.map(item => ({ ...item.toJSON(), ledger: bySupplier.get(item.id) || null, outstanding: Number(bySupplier.get(item.id)?.balance || 0) })));
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await supplier.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [purchaseOrder] });
    if (!item) throw new AppError('Not found', 404);
    const ledger = await accounting.getSupplierLedger(req.tenantId, item.id);
    res.status(200).json({ ...item.toJSON(), ledger, outstanding: Number(ledger.balance || 0) });
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await supplier.create({ ...req.body, tenant_id: req.tenantId }, { transaction });
    await accounting.ensureSupplierLedger(req.tenantId, item, transaction);
    await transaction.commit();
    res.status(201).json(item);
  } catch (error) { await transaction.rollback(); next(error); }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const item = await supplier.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!item) throw new AppError('Not found', 404);
    await item.update(req.body, { transaction });
    await accounting.ensureSupplierLedger(req.tenantId, item, transaction);
    await transaction.commit();
    res.status(200).json({ message: 'Updated successfully' });
  } catch (error) { await transaction.rollback(); next(error); }
};

exports.getLedger = async (req, res, next) => {
  try {
    const ledger = await accounting.getSupplierLedger(req.tenantId, req.params.id);
    const lines = await journalEntryLine.findAll({ where: { account_id: ledger.id }, include: [{ model: db.journalEntry, where: { tenant_id: req.tenantId, status: 'posted' } }], order: [[db.journalEntry, 'entry_date', 'ASC'], ['created_at', 'ASC']] });
    let balance = 0;
    const entries = lines.map(line => { balance += Number(line.credit || 0) - Number(line.debit || 0); return { id: line.id, date: line.journalEntry.entry_date, entry_number: line.journalEntry.entry_number, reference_type: line.journalEntry.reference_type, reference_id: line.journalEntry.reference_id, description: line.description || line.journalEntry.narration, debit: Number(line.debit || 0), credit: Number(line.credit || 0), balance }; });
    res.json({ ledger, entries });
  } catch (error) { next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const purchaseCount = await purchaseInvoice.count({ where: { supplier_id: req.params.id, tenant_id: req.tenantId } });
    const orderCount = await purchaseOrder.count({ where: { supplier_id: req.params.id, tenant_id: req.tenantId } });
    if (purchaseCount || orderCount) {
      throw new AppError(`Delete this supplier's ${purchaseCount ? `${purchaseCount} purchase(s)` : ''}${purchaseCount && orderCount ? ' and ' : ''}${orderCount ? `${orderCount} purchase order(s)` : ''} first`, 409);
    }
    const deleted = await supplier.destroy({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!deleted) throw new AppError('Not found', 404);
    res.status(200).json({ message: 'Deleted successfully' });
  } catch (error) { next(error); }
};
