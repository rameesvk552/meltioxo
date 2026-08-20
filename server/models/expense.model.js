module.exports = (sequelize, DataTypes) => {
  const Expense = sequelize.define('expense', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    expense_number: { type: DataTypes.STRING },
    account_id: { type: DataTypes.UUID },
    amount: { type: DataTypes.DECIMAL(15,2) },
    expense_date: { type: DataTypes.DATEONLY },
    payment_mode: { type: DataTypes.STRING(30) },
    payment_method_id: { type: DataTypes.UUID, allowNull: true },
    bank_account_id: { type: DataTypes.UUID, allowNull: true },
    description: { type: DataTypes.TEXT },
    category: { type: DataTypes.STRING, allowNull: true },
    status: { type: DataTypes.ENUM('draft','approved'), defaultValue: 'draft' },
    journal_entry_id: { type: DataTypes.UUID, allowNull: true },
    created_by: { type: DataTypes.UUID },
    approved_by: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'expenses',
    underscored: true,
    timestamps: true
  });
  return Expense;
};
