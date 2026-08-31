module.exports = (sequelize, DataTypes) => {
  const PurchaseInvoice = sequelize.define('purchaseInvoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    invoice_number: { type: DataTypes.STRING },
    purchase_order_id: { type: DataTypes.UUID },
    receipt_id: { type: DataTypes.UUID, allowNull: true },
    supplier_id: { type: DataTypes.UUID },
    invoice_date: { type: DataTypes.DATEONLY },
    due_date: { type: DataTypes.DATEONLY },
    total_amount: { type: DataTypes.DECIMAL(15,2) },
    paid_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    status: { type: DataTypes.ENUM('draft','unpaid','partial','paid','overdue'), defaultValue: 'draft' },
    paid_immediately: { type: DataTypes.BOOLEAN, defaultValue: false },
    payment_splits: { type: DataTypes.JSONB, allowNull: true },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'purchase_invoices',
    underscored: true,
    timestamps: true
  });
  return PurchaseInvoice;
};
