module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('customer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    name: { type: DataTypes.STRING },
    contact_person: { type: DataTypes.STRING, allowNull: true },
    email: { type: DataTypes.STRING, allowNull: true },
    phone: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    tax_id: { type: DataTypes.STRING, allowNull: true },
    payment_terms: { type: DataTypes.INTEGER, defaultValue: 30 },
    credit_limit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, defaultValue: true }
  }, {
    tableName: 'customers',
    underscored: true,
    timestamps: true
  });
  return Customer;
};
