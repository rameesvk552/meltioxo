module.exports = (sequelize, DataTypes) => {
  const ProductionOrder = sequelize.define('productionOrder', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    order_number: { type: DataTypes.STRING },
    formula_id: { type: DataTypes.UUID },
    finished_good_id: { type: DataTypes.UUID, allowNull: true },
    retail_sale_id: { type: DataTypes.UUID, allowNull: true },
    batch_number: { type: DataTypes.STRING },
    planned_qty: { type: DataTypes.DECIMAL(15,4) },
    actual_qty: { type: DataTypes.DECIMAL(15,4), allowNull: true },
    status: { type: DataTypes.ENUM('planned','in_progress','completed','cancelled'), defaultValue: 'planned' },
    planned_date: { type: DataTypes.DATEONLY },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    completion_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'production_orders',
    underscored: true,
    timestamps: true
  });
  return ProductionOrder;
};
