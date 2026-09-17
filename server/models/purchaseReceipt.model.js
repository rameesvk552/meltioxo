module.exports = (sequelize, DataTypes) => {
  const PurchaseReceipt = sequelize.define('purchaseReceipt', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    receipt_number: { type: DataTypes.STRING },
    purchase_order_id: { type: DataTypes.UUID },
    received_date: { type: DataTypes.DATEONLY },
    notes: { type: DataTypes.TEXT, allowNull: true },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'purchase_receipts',
    underscored: true,
    timestamps: true
  });
  return PurchaseReceipt;
};
