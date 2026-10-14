module.exports = (sequelize, DataTypes) => {
  const PurchaseOrder = sequelize.define('purchaseOrder', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    po_number: { type: DataTypes.STRING },
    supplier_id: { type: DataTypes.UUID },
    status: { type: DataTypes.ENUM('draft','approved','sent','partial','completed','cancelled'), defaultValue: 'draft' },
    order_date: { type: DataTypes.DATEONLY },
    expected_date: { type: DataTypes.DATEONLY, allowNull: true },
    subtotal: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.UUID },
    approved_by: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'purchase_orders',
    underscored: true,
    timestamps: true
  });
  return PurchaseOrder;
};
