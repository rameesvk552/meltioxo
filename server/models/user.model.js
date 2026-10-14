module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    password_hash: { type: DataTypes.STRING },
    role: { type: DataTypes.ENUM('super_admin','admin','manager','accountant','production_mgr','warehouse','sales','viewer') },
    permissions: { type: DataTypes.JSONB, allowNull: true, defaultValue: null },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login: { type: DataTypes.DATE }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true
  });
  return User;
};
