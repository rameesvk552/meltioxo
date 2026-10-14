module.exports = (sequelize, DataTypes) => {
  const WhatsappChannel = sequelize.define('whatsappChannel', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    provider_connection_id: { type: DataTypes.STRING(255), allowNull: false },
    provider: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'MARKETING_OS' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PENDING' },
    onboarding_mode: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'STANDARD' },
    marketing_os_tenant_id: { type: DataTypes.STRING(255), allowNull: false },
    business_account_id: { type: DataTypes.STRING(255) },
    phone_number_id: { type: DataTypes.STRING(255) },
    display_phone_number: { type: DataTypes.STRING(40) },
    label: { type: DataTypes.STRING(120) },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    error_message: { type: DataTypes.TEXT },
    contact_sync_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
    history_sync_status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'NOT_STARTED' },
    last_synced_at: { type: DataTypes.DATE },
  }, {
    tableName: 'whatsapp_channels',
    underscored: true,
    timestamps: true,
    indexes: [
      { unique: true, fields: ['tenant_id', 'provider_connection_id'] },
      { fields: ['tenant_id', 'is_active'] },
    ],
  });

  return WhatsappChannel;
};
