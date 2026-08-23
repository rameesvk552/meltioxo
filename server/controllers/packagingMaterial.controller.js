const { packagingMaterial, stockBatch, stockMovement, formulaPackaging, variantPackaging } = require('../models');
const { AppError } = require('../middleware/errorHandler');

// The database enum uses singular machine-friendly values; older clients send
// display labels such as "Boxes". Normalize them before writing to PostgreSQL.
const packagingTypes = new Set(['bottle', 'cap', 'spray', 'label', 'box', 'other']);
const typeAliases = { bottles: 'bottle', caps: 'cap', sprays: 'spray', labels: 'label', boxes: 'box', wrapping: 'other', inserts: 'other' };
const normalizeType = (type) => {
  if (typeof type !== 'string') return type;
  const value = typeAliases[type.trim().toLowerCase()] || type.trim().toLowerCase();
  if (!packagingTypes.has(value)) throw new AppError('Type must be one of: bottle, cap, spray, label, box, or other', 400);
  return value;
};

exports.getAll = async (req, res, next) => {
  try {
    res.json(await packagingMaterial.findAll({ where: { tenant_id: req.tenantId } }));
  } catch (error) { next(error); }
};

exports.getById = async (req, res, next) => {
  try {
    const item = await packagingMaterial.findOne({
      where: { id: req.params.id, tenant_id: req.tenantId },
      include: [stockBatch, stockMovement]
    });
    if (!item) throw new AppError('Not found', 404);
    res.json(item);
  } catch (error) { next(error); }
};

exports.create = async (req, res, next) => {
  try {
    const sequence = await packagingMaterial.count({ where: { tenant_id: req.tenantId } }) + 1;
    res.status(201).json(await packagingMaterial.create({
      ...req.body,
      type: normalizeType(req.body.type),
      sku: req.body.sku || `PM-${String(sequence).padStart(4, '0')}`,
      tenant_id: req.tenantId
    }));
  } catch (error) { next(error); }
};

exports.update = async (req, res, next) => {
  try {
    const values = { ...req.body };
    if (values.type !== undefined) values.type = normalizeType(values.type);
    const [updated] = await packagingMaterial.update(values, {
      where: { id: req.params.id, tenant_id: req.tenantId }
    });
    if (!updated) throw new AppError('Not found', 404);
    res.json({ message: 'Updated successfully' });
  } catch (error) { next(error); }
};

exports.delete = async (req, res, next) => {
  try {
    const [formulaCount, variantCount] = await Promise.all([
      formulaPackaging.count({ where: { packaging_material_id: req.params.id } }),
      variantPackaging.count({ where: { packaging_material_id: req.params.id } })
    ]);
    if (formulaCount || variantCount) {
      const uses = [];
      if (variantCount) uses.push(`${variantCount} variant(s)`);
      if (formulaCount) uses.push(`${formulaCount} formula(s)`);
      throw new AppError(`Remove this packaging material from ${uses.join(' and ')} before deleting it.`, 409);
    }
    const deleted = await packagingMaterial.destroy({
      where: { id: req.params.id, tenant_id: req.tenantId }
    });
    if (!deleted) throw new AppError('Not found', 404);
    res.json({ message: 'Deleted successfully' });
  } catch (error) { next(error); }
};
