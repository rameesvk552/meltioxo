module.exports = (sequelize, DataTypes) => sequelize.define('packingKit', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(50), allowNull: false },
  name: { type: DataTypes.STRING(150), allowNull: false },
  minimum_fill_ml: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  maximum_fill_ml: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'packing_kits', underscored: true, timestamps: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'code'] }, { fields: ['tenant_id', 'minimum_fill_ml', 'maximum_fill_ml'] }]
});
