module.exports = (sequelize, DataTypes) => {
  const StockMovement = sequelize.define('stockMovement', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging','finished') },
    material_id: { type: DataTypes.UUID },
    movement_type: { type: DataTypes.ENUM('purchase','consumption','production','adjustment','sale','return') },
    direction: { type: DataTypes.ENUM('in','out') },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    unit_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    total_cost: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    batch_id: { type: DataTypes.UUID, allowNull: true },
    reference_type: { type: DataTypes.STRING },
    reference_id: { type: DataTypes.UUID },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'stock_movements',
    underscored: true,
    timestamps: true
  });
  return StockMovement;
};
