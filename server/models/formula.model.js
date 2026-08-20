module.exports = (sequelize, DataTypes) => {
  const Formula = sequelize.define('formula', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    code: { type: DataTypes.STRING },
    name: { type: DataTypes.STRING },
    description: { type: DataTypes.TEXT, allowNull: true },
    output_quantity: { type: DataTypes.DECIMAL(15,4), defaultValue: 1 },
    output_unit: { type: DataTypes.STRING, defaultValue: 'pcs' },
    version: { type: DataTypes.INTEGER, defaultValue: 1 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
    created_by: { type: DataTypes.UUID }
  }, {
    tableName: 'formulas',
    underscored: true,
    timestamps: true
  });
  return Formula;
};
