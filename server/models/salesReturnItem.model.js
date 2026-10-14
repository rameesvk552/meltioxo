module.exports = (sequelize, DataTypes) => sequelize.define('salesReturnItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  sales_return_id: { type: DataTypes.UUID, allowNull: false },
  retail_sale_item_id: { type: DataTypes.UUID, allowNull: false },
  finished_good_id: { type: DataTypes.UUID, allowNull: true },
  packaging_material_id: { type: DataTypes.UUID, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  restock_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  cost_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 }
}, {
  tableName: 'sales_return_items',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['sales_return_id'] },
    { fields: ['retail_sale_item_id'] }
  ]
});
