const db = require('../models');
const { journalEntry, journalEntryLine } = db;
const { AppError } = require('../middleware/errorHandler');
const accountingService = require('../services/accounting.service');

exports.getAll = async (req, res, next) => {
  try {
    const items = await journalEntry.findAll({ where: { tenant_id: req.tenantId } });
    res.status(200).json(items);
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await journalEntry.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, include: [journalEntryLine] });
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
