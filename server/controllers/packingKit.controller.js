const db = require('../models');
const { Op } = require('sequelize');
const { randomBytes } = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const include = [{ model: db.packingKitItem, include: [db.packagingMaterial] }];
const generateKitCode = () => `KIT-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;

const validatePayload = async (tenantId, body, transaction, currentId = null, fallbackCode = null) => {
  const name = String(body.name || '').trim();
  const code = String(body.code || fallbackCode || generateKitCode()).trim();
  const hasFillQuantity = body.fill_quantity_ml !== undefined && body.fill_quantity_ml !== null;
  const fillQuantity = Number(body.fill_quantity_ml);
  const minimum = Number(hasFillQuantity ? fillQuantity : body.minimum_fill_ml);
  const maximum = Number(hasFillQuantity ? fillQuantity : body.maximum_fill_ml);
  const items = Array.isArray(body.items) ? body.items : [];
  if (!name) throw new AppError('Packing kit name is required', 400);
  if (!Number.isFinite(minimum) || minimum <= 0 || !Number.isFinite(maximum) || maximum < minimum) {
    throw new AppError('Enter a valid fill quantity', 400);
  }
  if (!items.length) throw new AppError('Add at least one packaging material to the kit', 400);
  const materialIds = items.map(row => row.packaging_material_id);
  if (materialIds.some(id => !id) || items.some(row => !Number.isFinite(Number(row.quantity)) || Number(row.quantity) <= 0)) {
    throw new AppError('Every kit item needs a packaging material and positive quantity', 400);
  }
  if (new Set(materialIds).size !== materialIds.length) throw new AppError('A packaging material can only appear once in a kit', 400);
  const [materials, duplicate] = await Promise.all([
    db.packagingMaterial.count({ where: { tenant_id: tenantId, id: materialIds }, transaction }),
    db.packingKit.findOne({ where: { tenant_id: tenantId, code, ...(currentId ? { id: { [Op.ne]: currentId } } : {}) }, transaction })
  ]);
  if (materials !== materialIds.length) throw new AppError('One or more packaging materials are invalid', 400);
  if (duplicate) throw new AppError('That packing kit code is already in use', 400);
  return { name, code, minimum, maximum, items, fillQuantity: minimum };
};

exports.getAll = async (req, res, next) => {
  try {
    const fill = req.query.fill_ml === undefined ? null : Number(req.query.fill_ml);
    if (fill !== null && (!Number.isFinite(fill) || fill <= 0)) throw new AppError('Fill quantity must be greater than zero', 400);
    const where = { tenant_id: req.tenantId };
    if (fill !== null) Object.assign(where, { is_active: true, minimum_fill_ml: { [Op.lte]: fill }, maximum_fill_ml: { [Op.gte]: fill } });
    const kits = await db.packingKit.findAll({ where, include, order: [['priority', 'DESC'], ['is_default', 'DESC'], ['name', 'ASC']] });
    res.json(kits.map(kit => ({ ...kit.toJSON(), fill_quantity_ml: kit.minimum_fill_ml })));
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const values = await validatePayload(req.tenantId, req.body, transaction);
    const kit = await db.packingKit.create({
      tenant_id: req.tenantId, code: values.code, name: values.name,
      minimum_fill_ml: values.minimum, maximum_fill_ml: values.maximum,
      priority: Number(req.body.priority || 0), is_default: Boolean(req.body.is_default), is_active: req.body.is_active !== false
    }, { transaction });
    await db.packingKitItem.bulkCreate(values.items.map(row => ({ packing_kit_id: kit.id, packaging_material_id: row.packaging_material_id, quantity: Number(row.quantity) })), { transaction });
    await transaction.commit();
    const result = await db.packingKit.findByPk(kit.id, { include });
    res.status(201).json({ ...result.toJSON(), fill_quantity_ml: result.minimum_fill_ml });
  } catch (error) { if (!transaction.finished) await transaction.rollback(); next(error); }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const kit = await db.packingKit.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!kit) throw new AppError('Packing kit not found', 404);
    const values = await validatePayload(req.tenantId, req.body, transaction, kit.id, kit.code);
    await kit.update({ code: values.code, name: values.name, minimum_fill_ml: values.minimum, maximum_fill_ml: values.maximum, priority: Number(req.body.priority || 0), is_default: Boolean(req.body.is_default), is_active: req.body.is_active !== false }, { transaction });
    await db.packingKitItem.destroy({ where: { packing_kit_id: kit.id }, transaction });
    await db.packingKitItem.bulkCreate(values.items.map(row => ({ packing_kit_id: kit.id, packaging_material_id: row.packaging_material_id, quantity: Number(row.quantity) })), { transaction });
    await transaction.commit();
    const result = await db.packingKit.findByPk(kit.id, { include });
    res.json({ ...result.toJSON(), fill_quantity_ml: result.minimum_fill_ml });
  } catch (error) { if (!transaction.finished) await transaction.rollback(); next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const kit = await db.packingKit.findOne({ where: { id: req.params.id, tenant_id: req.tenantId } });
    if (!kit) throw new AppError('Packing kit not found', 404);
    const used = await db.retailSaleItem.count({ where: { packing_kit_id: kit.id } });
    if (used) throw new AppError('This kit is used by sales. Mark it inactive instead of deleting it.', 409);
    await kit.destroy();
    res.json({ message: 'Packing kit deleted successfully' });
  } catch (error) { next(error); }
};
