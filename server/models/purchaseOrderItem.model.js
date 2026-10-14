module.exports = (sequelize, DataTypes) => {
  const PurchaseOrderItem = sequelize.define('purchaseOrderItem', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    purchase_order_id: { type: DataTypes.UUID },
    material_type: { type: DataTypes.ENUM('raw','packaging','finished') },
    material_id: { type: DataTypes.UUID },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    received_qty: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    unit_price: { type: DataTypes.DECIMAL(15,4) },
    tax_rate: { type: DataTypes.DECIMAL(5,2), defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 }
  }, {
    tableName: 'purchase_order_items',
    underscored: true,
    timestamps: true
  });
  return PurchaseOrderItem;
};
