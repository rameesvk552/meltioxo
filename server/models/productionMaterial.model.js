module.exports = (sequelize, DataTypes) => {
  const ProductionMaterial = sequelize.define('productionMaterial', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    production_order_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging') },
    material_id: { type: DataTypes.UUID },
    required_qty: { type: DataTypes.DECIMAL(15,4) },
    available_qty: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    consumed_qty: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    consumed_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    is_available: { type: DataTypes.BOOLEAN, defaultValue: false }
  }, {
    tableName: 'production_materials',
    underscored: true,
    timestamps: true
  });
  return ProductionMaterial;
};
