module.exports = (sequelize, DataTypes) => sequelize.define('retailSaleItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  retail_sale_id: { type: DataTypes.UUID, allowNull: false },
  finished_good_id: { type: DataTypes.UUID, allowNull: false },
  fulfillment_mode: { type: DataTypes.ENUM('stock', 'make_now'), allowNull: false, defaultValue: 'stock' },
  production_order_id: { type: DataTypes.UUID, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(15,4), allowNull: false },
  unit_price: { type: DataTypes.DECIMAL(15,2), allowNull: false },
  discount_pct: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  tax_rate: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  cost_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }
}, { tableName: 'retail_sale_items', underscored: true, timestamps: true });
