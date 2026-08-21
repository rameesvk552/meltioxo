module.exports = (sequelize, DataTypes) => {
  const FinishedGood = sequelize.define('finishedGood', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    sku: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    product_id: { type: DataTypes.UUID, allowNull: true },
    formula_id: { type: DataTypes.UUID, allowNull: true },
    source_type: { type: DataTypes.ENUM('live_make', 'ready_made'), allowNull: false, defaultValue: 'live_make' },
    size_label: { type: DataTypes.STRING, allowNull: true },
    fill_quantity_ml: { type: DataTypes.DECIMAL(15,4), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    selling_price: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    cost_price: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    current_stock: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 },
    reorder_level: { type: DataTypes.DECIMAL(15,4), defaultValue: 0 }
  }, {
    tableName: 'finished_goods',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'sku']
      }
    ]
  });
  return FinishedGood;
};
