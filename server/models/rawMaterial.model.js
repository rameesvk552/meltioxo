module.exports = (sequelize, DataTypes) => {
  const RawMaterial = sequelize.define('rawMaterial', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    sku: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    // Categories are defined by each tenant, so this must remain free text rather
    // than a database enum with a fixed set of values.
    category: { type: DataTypes.STRING(100), allowNull: false },
    unit: { type: DataTypes.STRING },
    current_stock: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    reserved_stock: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    reorder_level: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    avg_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    last_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 }
  }, {
    tableName: 'raw_materials',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'sku']
      }
    ]
  });
  return RawMaterial;
};
