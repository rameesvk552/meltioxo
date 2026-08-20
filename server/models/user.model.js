module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('user', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING },
    email: { type: DataTypes.STRING },
    password_hash: { type: DataTypes.STRING },
    role: { type: DataTypes.ENUM('super_admin','admin','manager','accountant','production_mgr','warehouse','sales','viewer') },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    last_login: { type: DataTypes.DATE }
  }, {
    tableName: 'users',
    underscored: true,
    timestamps: true
  });
  return User;
};
