module.exports = (sequelize, DataTypes) => sequelize.define('retailSaleItemPackaging', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  retail_sale_item_id: { type: DataTypes.UUID, allowNull: false },
  packing_kit_id: { type: DataTypes.UUID, allowNull: true },
  packaging_material_id: { type: DataTypes.UUID, allowNull: false },
  material_name: { type: DataTypes.STRING(150), allowNull: false },
  quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  unit_cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
  total_cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 }
}, {
  tableName: 'retail_sale_item_packagings', underscored: true, timestamps: true,
  indexes: [{ fields: ['retail_sale_item_id'] }, { fields: ['packaging_material_id'] }]
});
