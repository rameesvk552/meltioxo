const db = require('../models');
const { AppError } = require('../middleware/errorHandler');
const SOURCE_TYPES = ['live_make', 'ready_made'];

const productInclude = [
  db.formula,
  { model: db.finishedGood, include: [db.variantPackaging] }
];

exports.getAll = async (req, res, next) => {
  try {
    const items = await db.product.findAll({
      where: { tenant_id: req.tenantId },
      include: productInclude,
      order: [['name', 'ASC']]
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await db.product.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: productInclude
    });
    if (!item) throw new AppError('Product not found', 404);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

exports.create = async (req, res, next) => {
  try {
    if (!String(req.body.name || '').trim()) {
      throw new AppError('Product name is required', 400);
    }
    const sourceType = req.body.source_type || 'live_make';
    if (!SOURCE_TYPES.includes(sourceType)) throw new AppError('Select Ready-made or Make live for this product', 400);
    const requestedFormulaId = sourceType === 'ready_made' ? null : req.body.formula_id;
    const formula = requestedFormulaId ? await db.formula.findOne({
      where: { id: requestedFormulaId, tenant_id: req.tenantId }
    }) : null;
    if (requestedFormulaId && !formula) throw new AppError('Formula not found for this company', 400);

    const sequence = await db.product.count({ where: { tenant_id: req.tenantId } }) + 1;
    const item = await db.product.create({
      tenant_id: req.tenantId,
      code: req.body.code || `PROD-${String(sequence).padStart(4, '0')}`,
      name: req.body.name,
      description: req.body.description,
      source_type: sourceType,
      formula_id: formula?.id || null,
      is_active: req.body.is_active ?? true
    });
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

exports.update = async (req, res, next) => {
  const transaction = await db.sequelize.transaction();
  try {
    const product = await db.product.findOne({ where: { id: req.params.id, tenant_id: req.tenantId }, transaction });
    if (!product) throw new AppError('Product not found', 404);
    const previousFormulaId = product.formula_id;
    const sourceType = req.body.source_type || product.source_type || 'live_make';
    if (!SOURCE_TYPES.includes(sourceType)) throw new AppError('Select Ready-made or Make live for this product', 400);
    const requestedFormulaId = sourceType === 'ready_made' ? null : req.body.formula_id;
    if (requestedFormulaId) {
      const formula = await db.formula.findOne({
        where: { id: requestedFormulaId, tenant_id: req.tenantId },
        transaction
      });
      if (!formula) throw new AppError('Formula not found for this company', 400);
    }

    const updates = { ...req.body, source_type: sourceType };
    if (sourceType === 'ready_made') updates.formula_id = null;
    await product.update(updates, { transaction });

    if (req.body.formula_id) {
      const { Op } = db.Sequelize;
      await db.finishedGood.update(
        { formula_id: null },
        { where: { product_id: req.params.id, tenant_id: req.tenantId, formula_id: { [Op.in]: [previousFormulaId, req.body.formula_id] } }, transaction }
      );
    }

    await transaction.commit();
    res.json({ message: 'Product updated successfully' });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
