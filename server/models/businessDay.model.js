module.exports = (sequelize, DataTypes) => sequelize.define('businessDay', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  business_date: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open', validate: { isIn: [['open', 'closed']] } },
  opening_cash: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  expected_cash: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  counted_cash: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  cash_variance: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
  total_sales: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  total_cogs: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  sales_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  payment_summary: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  opening_note: { type: DataTypes.TEXT, allowNull: true },
  closing_note: { type: DataTypes.TEXT, allowNull: true },
  opened_by: { type: DataTypes.UUID, allowNull: true },
  closed_by: { type: DataTypes.UUID, allowNull: true },
  opened_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  closed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'business_days',
  underscored: true,
  timestamps: true,
  indexes: [
    { unique: true, fields: ['tenant_id', 'business_date'] },
    { fields: ['tenant_id', 'status'] }
  ]
});
