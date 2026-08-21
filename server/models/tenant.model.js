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
    status: { type: DataTypes.ENUM('active','suspended','deactivated'), defaultValue: 'active' }
  }, {
    tableName: 'tenants',
    underscored: true,
    timestamps: true
  });
  return Tenant;
};
