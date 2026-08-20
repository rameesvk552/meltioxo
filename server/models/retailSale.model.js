module.exports = (sequelize, DataTypes) => sequelize.define('retailSale', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  sale_number: { type: DataTypes.STRING, allowNull: false },
  sale_date: { type: DataTypes.DATEONLY, allowNull: false },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  payment_account_id: { type: DataTypes.UUID, allowNull: false },
  payment_method_id: { type: DataTypes.UUID, allowNull: true },
  subtotal: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  cogs_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT, allowNull: true },
  journal_entry_id: { type: DataTypes.UUID, allowNull: true },
  cogs_journal_id: { type: DataTypes.UUID, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true }
}, { tableName: 'retail_sales', underscored: true, timestamps: true, indexes: [{ unique: true, fields: ['tenant_id', 'sale_number'] }] });
