module.exports = (sequelize, DataTypes) => {
  return sequelize.define('productionOutput', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    production_order_id: { type: DataTypes.UUID, allowNull: false },
    finished_good_id: { type: DataTypes.UUID, allowNull: false },
    planned_qty: { type: DataTypes.DECIMAL(15, 4), allowNull: false },
    actual_qty: { type: DataTypes.DECIMAL(15, 4), allowNull: true }
  }, { tableName: 'production_outputs', underscored: true, timestamps: true });
};
