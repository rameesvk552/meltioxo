module.exports = (sequelize, DataTypes) => sequelize.define('packingKitItem', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  packing_kit_id: { type: DataTypes.UUID, allowNull: false },
  packaging_material_id: { type: DataTypes.UUID, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 1 }
}, {
  tableName: 'packing_kit_items', underscored: true, timestamps: true,
  indexes: [{ unique: true, fields: ['packing_kit_id', 'packaging_material_id'] }]
});
