const db = require('../models');
const { Op } = require('sequelize');

// Update stock for a material
exports.updateStock = async (tenantId, materialType, materialId, quantityChange, transaction) => {
  const Model = materialType === 'raw' ? db.rawMaterial : 
                materialType === 'packaging' ? db.packagingMaterial : db.finishedGood;
  const material = await Model.findOne({ where: { id: materialId, tenant_id: tenantId }, transaction });
  if (!material) throw new Error('Material not found');
  await material.update({ 
    current_stock: parseFloat(material.current_stock) + quantityChange 
  }, { transaction });
  return material;
};

// Create a stock batch
exports.createBatch = async (data, transaction) => {
  return db.stockBatch.create(data, { transaction });
};

// Log a stock movement
exports.logMovement = async (data, transaction) => {
  return db.stockMovement.create(data, { transaction });
};

// Calculate weighted average cost
exports.calculateAvgCost = async (tenantId, materialType, materialId) => {
  const batches = await db.stockBatch.findAll({
    where: { tenant_id: tenantId, material_type: materialType, material_id: materialId },
    attributes: ['remaining_qty', 'cost_per_unit']
  });
  let totalValue = 0, totalQty = 0;
  batches.forEach(b => {
    totalValue += parseFloat(b.remaining_qty) * parseFloat(b.cost_per_unit);
    totalQty += parseFloat(b.remaining_qty);
  });
  return totalQty > 0 ? totalValue / totalQty : 0;
};

// Get low stock alerts
exports.getLowStockAlerts = async (tenantId) => {
  const [rawAlerts, pkgAlerts, fgAlerts] = await Promise.all([
    db.rawMaterial.findAll({ where: { tenant_id: tenantId, current_stock: { [Op.lte]: db.sequelize.col('reorder_level') } } }),
    db.packagingMaterial.findAll({ where: { tenant_id: tenantId, current_stock: { [Op.lte]: db.sequelize.col('reorder_level') } } }),
    db.finishedGood.findAll({ where: { tenant_id: tenantId, current_stock: { [Op.lte]: db.sequelize.col('reorder_level') } } })
  ]);
  return { raw: rawAlerts, packaging: pkgAlerts, finished: fgAlerts };
};
