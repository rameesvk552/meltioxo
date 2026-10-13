const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const businessDays = require('../services/businessDay.service');

const includeUsers = [
  { model: db.user, as: 'openedBy', attributes: ['id', 'name'] },
  { model: db.user, as: 'closedBy', attributes: ['id', 'name'] }
];

const serializeWithSummary = async (day, tenantId, transaction) => {
  if (!day) return null;
  const data = day.toJSON();
  if (day.status === 'closed') return data;
  const summary = await businessDays.summarize(tenantId, day.id, transaction);
  return {
    ...data,
    ...summary,
    expected_cash: businessDays.money(Number(day.opening_cash || 0) + summary.cash_movement)
  };
};

exports.current = async (req, res, next) => {
  try {
    const today = businessDays.businessDate();
    const current = await db.businessDay.findOne({
      where: { tenant_id: req.tenantId, status: 'open' },
      include: includeUsers,
      order: [['opened_at', 'DESC']]
    });
    const todayRecord = current?.business_date === today ? current : await db.businessDay.findOne({
      where: { tenant_id: req.tenantId, business_date: today },
      include: includeUsers
    });
    const previousClose = await db.businessDay.findOne({
      where: { tenant_id: req.tenantId, status: 'closed' },
      order: [['business_date', 'DESC']]
    });
    res.json({
      business_date: today,
      time_zone: businessDays.BUSINESS_TIME_ZONE,
      can_open: !current && !todayRecord,
      previous_close: previousClose,
      current: await serializeWithSummary(current, req.tenantId),
      today_record: todayRecord ? await serializeWithSummary(todayRecord, req.tenantId) : null
    });
  } catch (error) { next(error); }
};

exports.history = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 100);
    res.json(await db.businessDay.findAll({
      where: { tenant_id: req.tenantId },
      include: includeUsers,
      order: [['business_date', 'DESC']],
      limit
    }));
  } catch (error) { next(error); }
};

exports.open = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const openingCash = businessDays.money(req.body.opening_cash);
    if (!Number.isFinite(Number(req.body.opening_cash)) || openingCash < 0) throw new AppError('Opening cash must be zero or more', 400);
    if (db.sequelize.getDialect() === 'postgres') {
      await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:business-day` }, transaction });
    }
    const date = businessDays.businessDate();
    const current = await businessDays.findOpen(req.tenantId, transaction, true);
    if (current) throw new AppError(`Business day ${current.business_date} is already open`, 409);
    const existing = await db.businessDay.findOne({ where: { tenant_id: req.tenantId, business_date: date }, transaction, lock: transaction.LOCK.UPDATE });
    if (existing) throw new AppError(`Business day ${date} has already been ${existing.status}`, 409);
    const openingNote = String(req.body.opening_note || '').trim();
    const previousClosedDay = await db.businessDay.findOne({
      where: { tenant_id: req.tenantId, status: 'closed' },
      order: [['business_date', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (previousClosedDay?.counted_cash != null && Math.abs(openingCash - Number(previousClosedDay.counted_cash)) > 0.009 && !openingNote) {
      throw new AppError(`Opening cash differs from the previous close (${previousClosedDay.business_date}: ₹${Number(previousClosedDay.counted_cash).toFixed(2)}). Enter an opening note explaining the handover difference.`, 409);
    }
    const day = await db.businessDay.create({
      tenant_id: req.tenantId,
      business_date: date,
      opening_cash: openingCash,
      opening_note: openingNote || null,
      opened_by: req.user.id,
      opened_at: new Date(),
      status: 'open'
    }, { transaction });
    await transaction.commit();
    res.status(201).json(await db.businessDay.findByPk(day.id, { include: includeUsers }));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};

exports.close = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const countedCash = businessDays.money(req.body.counted_cash);
    if (!Number.isFinite(Number(req.body.counted_cash)) || countedCash < 0) throw new AppError('Counted cash must be zero or more', 400);
    if (db.sequelize.getDialect() === 'postgres') {
      await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `${req.tenantId}:business-day` }, transaction });
    }
    const day = await businessDays.findOpen(req.tenantId, transaction, true);
    if (!day) throw new AppError('There is no open business day to close', 409);
    const summary = await businessDays.summarize(req.tenantId, day.id, transaction);
    const expectedCash = businessDays.money(Number(day.opening_cash || 0) + summary.cash_movement);
    const cashVariance = businessDays.money(countedCash - expectedCash);
    const closingNote = String(req.body.closing_note || '').trim();
    if (Math.abs(cashVariance) > 0.009 && !closingNote) {
      throw new AppError(`Cash is out by ₹${Math.abs(cashVariance).toFixed(2)}. Enter a closing note explaining the difference before closing.`, 409);
    }
    await day.update({
      status: 'closed',
      expected_cash: expectedCash,
      counted_cash: countedCash,
      cash_variance: cashVariance,
      total_sales: summary.total_sales,
      total_cogs: summary.total_cogs,
      sales_count: summary.sales_count,
      payment_summary: summary.payment_summary,
      closing_note: closingNote || null,
      closed_by: req.user.id,
      closed_at: new Date()
    }, { transaction });
    await transaction.commit();
    res.json(await db.businessDay.findByPk(day.id, { include: includeUsers }));
  } catch (error) {
    if (!transaction.finished) await transaction.rollback();
    next(error);
  }
};
