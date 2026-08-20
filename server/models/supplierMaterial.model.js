module.exports = (sequelize, DataTypes) => {
  const SupplierMaterial = sequelize.define('supplierMaterial', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    supplier_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging') },
    material_id: { type: DataTypes.UUID },
    unit_price: { type: DataTypes.DECIMAL(15,4) },
    lead_time_days: { type: DataTypes.INTEGER, defaultValue: 7 }
  }, {
    tableName: 'supplier_materials',
    underscored: true,
    timestamps: true
  });
  return SupplierMaterial;
};
