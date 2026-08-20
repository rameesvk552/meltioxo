module.exports = (sequelize, DataTypes) => {
  const PurchaseInvoice = sequelize.define('purchaseInvoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    invoice_number: { type: DataTypes.STRING },
    purchase_order_id: { type: DataTypes.UUID },
    receipt_id: { type: DataTypes.UUID, allowNull: true },
    supplier_id: { type: DataTypes.UUID },
    invoice_date: { type: DataTypes.DATEONLY },
    due_date: { type: DataTypes.DATEONLY },
    total_amount: { type: DataTypes.DECIMAL(15,2) },
    paid_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    status: { type: DataTypes.ENUM('unpaid','partial','paid','overdue'), defaultValue: 'unpaid' },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'purchase_invoices',
    underscored: true,
    timestamps: true
  });
  return PurchaseInvoice;
};
