module.exports = (sequelize, DataTypes) => sequelize.define('inventoryDeficit', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  material_type: { type: DataTypes.ENUM('raw', 'packaging'), allowNull: false },
  material_id: { type: DataTypes.UUID, allowNull: false },
  production_order_id: { type: DataTypes.UUID, allowNull: false },
  stock_movement_id: { type: DataTypes.UUID, allowNull: true },
  quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  remaining_qty: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  estimated_unit_cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 0 },
  status: { type: DataTypes.ENUM('open', 'reconciled'), allowNull: false, defaultValue: 'open' },
  reconciled_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'inventory_deficits',
  underscored: true,
  timestamps: true,
  indexes: [
    { fields: ['tenant_id', 'material_type', 'material_id', 'status'] },
    { fields: ['production_order_id'] }
  ]
});
