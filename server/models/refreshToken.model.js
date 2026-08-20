module.exports = (sequelize, DataTypes) => {
  const RefreshToken = sequelize.define('refreshToken', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    user_id: { type: DataTypes.UUID },
    token: { type: DataTypes.STRING, unique: true },
    expires_at: { type: DataTypes.DATE }
  }, {
    tableName: 'refresh_tokens',
    underscored: true,
    timestamps: true
  });
  return RefreshToken;
};
