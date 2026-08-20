module.exports = (sequelize, DataTypes) => {
  const PackagingMaterial = sequelize.define('packagingMaterial', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    sku: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    // Tenant-defined category, such as "Premium bottles" or "Gift boxes".
    // Kept separate from the operational packaging type (bottle, cap, etc.).
    category: { type: DataTypes.STRING(100), allowNull: true },
    type: { type: DataTypes.ENUM('bottle','cap','spray','label','box','other') },
    unit: { type: DataTypes.STRING, defaultValue: 'pcs' },
    current_stock: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    reserved_stock: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    reorder_level: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    avg_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 }
  }, {
    tableName: 'packaging_materials',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'sku']
      }
    ]
  });
  return PackagingMaterial;
};
