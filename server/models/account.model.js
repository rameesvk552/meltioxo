module.exports = (sequelize, DataTypes) => {
  const Account = sequelize.define('account', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    code: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    type: { type: DataTypes.ENUM('asset','liability','equity','revenue','expense') },
    parent_id: { type: DataTypes.UUID, allowNull: true },
    // Groups organise the chart; only leaf ledgers may receive journal lines.
    is_group: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    balance: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }
  }, {
    tableName: 'accounts',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'code']
      }
    ]
  });
  return Account;
};
