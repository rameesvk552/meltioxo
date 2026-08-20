module.exports = (sequelize, DataTypes) => {
  const PaymentAllocation = sequelize.define('paymentAllocation', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    payment_id: { type: DataTypes.UUID },
    invoice_type: { type: DataTypes.ENUM('purchase','sale') },
    invoice_id: { type: DataTypes.UUID },
    allocated_amount: { type: DataTypes.DECIMAL(15,2) }
  }, {
    tableName: 'payment_allocations',
    underscored: true,
    timestamps: true
  });
  return PaymentAllocation;
};
