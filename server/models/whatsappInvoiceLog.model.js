module.exports = (sequelize, DataTypes) => sequelize.define('whatsappInvoiceLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  branch_id: { type: DataTypes.UUID, allowNull: true },
  retail_sale_id: { type: DataTypes.UUID, allowNull: true },
  sale_number: { type: DataTypes.STRING(100), allowNull: true },
  customer_id: { type: DataTypes.UUID, allowNull: true },
  customer_name: { type: DataTypes.STRING(255), allowNull: true },
  customer_phone_last4: { type: DataTypes.STRING(4), allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false },
  attempted: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  template_name: { type: DataTypes.STRING(255), allowNull: true },
  api_url: { type: DataTypes.TEXT, allowNull: true },
  provider_message_id: { type: DataTypes.STRING(255), allowNull: true },
  provider_status: { type: DataTypes.STRING(100), allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  sent_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'whatsapp_invoice_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['tenant_id', 'created_at'] },
    { fields: ['tenant_id', 'status', 'created_at'] },
    { fields: ['tenant_id', 'retail_sale_id'] }
  ]
});
