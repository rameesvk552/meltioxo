module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('product', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID, allowNull: false },
    code: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    source_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'live_make' },
    formula_id: { type: DataTypes.UUID, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: 'products',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'code']
      }
    ]
  });

  return Product;
};
