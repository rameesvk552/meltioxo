module.exports = (sequelize, DataTypes) => sequelize.define('salesReturn', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  branch_id: { type: DataTypes.UUID, allowNull: true },
  business_day_id: { type: DataTypes.UUID, allowNull: false },
  retail_sale_id: { type: DataTypes.UUID, allowNull: false },
  return_number: { type: DataTypes.STRING, allowNull: false },
  return_date: { type: DataTypes.DATEONLY, allowNull: false },
  refund_payment_method_id: { type: DataTypes.UUID, allowNull: false },
  refund_account_id: { type: DataTypes.UUID, allowNull: false },
  subtotal: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  discount_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  restocked_cost: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  reason: { type: DataTypes.STRING(250), allowNull: false },
  notes: { type: DataTypes.TEXT, allowNull: true },
  journal_entry_id: { type: DataTypes.UUID, allowNull: true },
  cogs_journal_id: { type: DataTypes.UUID, allowNull: true },
  payment_id: { type: DataTypes.UUID, allowNull: true },
  created_by: { type: DataTypes.UUID, allowNull: true }
}, {
  tableName: 'sales_returns',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'return_number'] },
    { fields: ['tenant_id', 'retail_sale_id'] },
    { fields: ['tenant_id', 'business_day_id'] }
  ]
});
