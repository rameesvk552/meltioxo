module.exports = (sequelize, DataTypes) => {
  const StockBatch = sequelize.define('stockBatch', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging','finished') },
    material_id: { type: DataTypes.UUID },
    batch_number: { type: DataTypes.STRING },
    supplier_id: { type: DataTypes.UUID },
    purchase_id: { type: DataTypes.UUID, allowNull: true },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    remaining_qty: { type: DataTypes.DECIMAL(15,4) },
    cost_per_unit: { type: DataTypes.DECIMAL(15,4) },
    received_date: { type: DataTypes.DATEONLY },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true }
  }, {
    tableName: 'stock_batches',
    underscored: true,
    timestamps: true
  });
  return StockBatch;
};
