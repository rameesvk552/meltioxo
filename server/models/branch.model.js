module.exports = (sequelize, DataTypes) => sequelize.define('branch', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  code: { type: DataTypes.STRING(30), allowNull: false },
  address: { type: DataTypes.TEXT, allowNull: true },
  phone: { type: DataTypes.STRING, allowNull: true },
  email: { type: DataTypes.STRING, allowNull: true },
  tax_id: { type: DataTypes.STRING, allowNull: true },
  is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, {
  tableName: 'branches', underscored: true, timestamps: true,
  indexes: [{ unique: true, fields: ['tenant_id', 'code'] }, { fields: ['tenant_id', 'is_active'] }]
});
