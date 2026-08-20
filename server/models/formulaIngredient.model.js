module.exports = (sequelize, DataTypes) => {
  const FormulaIngredient = sequelize.define('formulaIngredient', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    formula_id: { type: DataTypes.UUID },
    raw_material_id: { type: DataTypes.UUID },
    quantity: { type: DataTypes.DECIMAL(15,4) },
    unit: { type: DataTypes.STRING }
  }, {
    tableName: 'formula_ingredients',
    underscored: true,
    timestamps: true
  });
  return FormulaIngredient;
};
