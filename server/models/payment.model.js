module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('payment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    business_day_id: { type: DataTypes.UUID, allowNull: true },
    payment_number: { type: DataTypes.STRING },
    payment_type: { type: DataTypes.ENUM('incoming','outgoing') },
    party_type: { type: DataTypes.ENUM('supplier','customer') },
    party_id: { type: DataTypes.UUID },
    payment_mode: { type: DataTypes.STRING(30) },
    payment_method_id: { type: DataTypes.UUID, allowNull: true },
    bank_account_id: { type: DataTypes.UUID, allowNull: true },
    amount: { type: DataTypes.DECIMAL(15,2) },
    payment_date: { type: DataTypes.DATEONLY },
    reference_number: { type: DataTypes.STRING, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'payments',
    underscored: true,
    timestamps: true
  });
  return Payment;
};
