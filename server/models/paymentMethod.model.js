module.exports = (sequelize, DataTypes) => {
  const PaymentMethod = sequelize.define('paymentMethod', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    account_id: { type: DataTypes.UUID, allowNull: false },
    name: { type: DataTypes.STRING(120), allowNull: false },
    method_type: {
      type: DataTypes.ENUM('CASH', 'BANK', 'UPI', 'CARD', 'WALLET', 'GATEWAY', 'OTHER'),
      allowNull: false,
      defaultValue: 'BANK'
    },
    is_default: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  }, {
    tableName: 'payment_methods',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['tenant_id', 'account_id'] },
      { fields: ['tenant_id', 'is_active'] },
      { unique: true, fields: ['tenant_id', 'name'] }
    ]
  });
  return PaymentMethod;
};
