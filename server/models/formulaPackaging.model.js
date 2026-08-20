module.exports = (sequelize, DataTypes) => {
  const FormulaPackaging = sequelize.define('formulaPackaging', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formula_id: { type: DataTypes.UUID },
    packaging_material_id: { type: DataTypes.UUID },
    quantity: { type: DataTypes.DECIMAL(15,4) }
  }, {
    tableName: 'formula_packagings',
    underscored: true,
    timestamps: true
  });
  return FormulaPackaging;
};
