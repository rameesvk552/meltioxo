module.exports = (sequelize, DataTypes) => {
  const PurchaseReceiptItem = sequelize.define('purchaseReceiptItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    receipt_id: { type: DataTypes.UUID },
    po_item_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging') },
    material_id: { type: DataTypes.UUID },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    batch_number: { type: DataTypes.STRING },
    expiry_date: { type: DataTypes.DATEONLY, allowNull: true }
  }, {
    tableName: 'purchase_receipt_items',
    underscored: true,
    timestamps: true
  });
  return PurchaseReceiptItem;
};
