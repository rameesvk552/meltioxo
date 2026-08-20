module.exports = (sequelize, DataTypes) => {
  const SalesOrder = sequelize.define('salesOrder', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    order_number: { type: DataTypes.STRING },
    customer_id: { type: DataTypes.UUID },
    status: { type: DataTypes.ENUM('draft','confirmed','invoiced','delivered','cancelled'), defaultValue: 'draft' },
    order_date: { type: DataTypes.DATEONLY },
    delivery_date: { type: DataTypes.DATEONLY, allowNull: true },
    subtotal: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    discount_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'sales_orders',
    underscored: true,
    timestamps: true
  });
  return SalesOrder;
};
