module.exports = (sequelize, DataTypes) => {
  const Tenant = sequelize.define('tenant', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING },
    slug: { type: DataTypes.STRING, unique: true },
    address: { type: DataTypes.TEXT },
    phone: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    tax_id: { type: DataTypes.STRING },
    logo_url: { type: DataTypes.TEXT },
    currency: { type: DataTypes.STRING, defaultValue: 'INR' },
    tax_system: { type: DataTypes.STRING, defaultValue: 'GST' },
    fy_start_month: { type: DataTypes.INTEGER, defaultValue: 4 },
    date_format: { type: DataTypes.STRING, defaultValue: 'DD/MM/YYYY' },
    measured_packaging_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    measured_packaging_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    measured_packaging_auto_select: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    show_formula_in_sales: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    packaging_material_sales_enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    whatsapp_provider: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MARKETING_OS' },
    whatsapp_connection_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_CONNECTED' },
    marketing_os_tenant_id: { type: DataTypes.STRING(255) },
    whatsapp_channel_id: { type: DataTypes.STRING(255) },
    whatsapp_business_account_id: { type: DataTypes.STRING(255) },
    whatsapp_phone_number_id: { type: DataTypes.STRING(255) },
    whatsapp_display_phone_number: { type: DataTypes.STRING(40) },
    whatsapp_onboarding_mode: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'STANDARD' },
    whatsapp_connection_error: { type: DataTypes.TEXT },
    whatsapp_last_synced_at: { type: DataTypes.DATE },
    whatsapp_coexistence_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_ENABLED' },
    whatsapp_contact_sync_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
    whatsapp_history_sync_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
    whatsapp_coexistence_last_synced_at: { type: DataTypes.DATE },
    status: { type: DataTypes.ENUM('active','suspended','deactivated'), defaultValue: 'active' }
  }, {
    tableName: 'tenants',
    underscored: true,
    timestamps: true
  });
  return Tenant;
};
