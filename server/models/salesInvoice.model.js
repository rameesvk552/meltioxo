module.exports = (sequelize, DataTypes) => {
  const SalesInvoice = sequelize.define('salesInvoice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    invoice_number: { type: DataTypes.STRING },
    sales_order_id: { type: DataTypes.UUID },
    customer_id: { type: DataTypes.UUID },
    invoice_date: { type: DataTypes.DATEONLY },
    due_date: { type: DataTypes.DATEONLY },
    subtotal: { type: DataTypes.DECIMAL(15,2) },
    discount_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total_amount: { type: DataTypes.DECIMAL(15,2) },
    paid_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    status: { type: DataTypes.ENUM('unpaid','partial','paid','overdue'), defaultValue: 'unpaid' },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true },
    cogs_journal_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'sales_invoices',
    underscored: true,
    timestamps: true
  });
  return SalesInvoice;
};
