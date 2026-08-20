module.exports = (sequelize, DataTypes) => {
  const SalesOrderItem = sequelize.define('salesOrderItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sales_order_id: { type: DataTypes.UUID },
    finished_good_id: { type: DataTypes.UUID },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    unit_price: { type: DataTypes.DECIMAL(15,2) },
    discount_pct: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
    tax_rate: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }
  }, {
    tableName: 'sales_order_items',
    underscored: true,
    timestamps: true
  });
  return SalesOrderItem;
};
