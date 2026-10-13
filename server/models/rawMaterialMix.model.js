module.exports = (sequelize, DataTypes) => sequelize.define('rawMaterialMix', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  branch_id: { type: DataTypes.UUID, allowNull: true },
  output_material_id: { type: DataTypes.UUID, allowNull: false },
  output_quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  total_cost: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
  batch_number: { type: DataTypes.STRING(100), allowNull: false },
  ingredients: { type: DataTypes.JSONB, allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  request_key: { type: DataTypes.STRING(100), allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'raw_material_mixes',
  underscored: true,
  timestamps: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'request_key'] }]
});
