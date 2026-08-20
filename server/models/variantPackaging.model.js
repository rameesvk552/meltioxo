module.exports = (sequelize, DataTypes) => {
  const VariantPackaging = sequelize.define('variantPackaging', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    finished_good_id: { type: DataTypes.UUID, allowNull: false },
    packaging_material_id: { type: DataTypes.UUID, allowNull: false },
    quantity: { type: DataTypes.DECIMAL(15, 4), allowNull: false, defaultValue: 1 }
  }, {
    tableName: 'variant_packagings',
    underscored: true,
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['finished_good_id', 'packaging_material_id']
      }
    ]
  });

  return VariantPackaging;
};
