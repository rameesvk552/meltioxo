module.exports = (sequelize, DataTypes) => {
  const JournalEntry = sequelize.define('journalEntry', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    tenant_id: { type: DataTypes.UUID },
    branch_id: { type: DataTypes.UUID, allowNull: true },
    entry_number: { type: DataTypes.STRING },
    entry_date: { type: DataTypes.DATEONLY },
    reference_type: { type: DataTypes.STRING, allowNull: true },
    reference_id: { type: DataTypes.UUID, allowNull: true },
    narration: { type: DataTypes.TEXT },
    status: { type: DataTypes.ENUM('draft','posted'), defaultValue: 'draft' },
    total_debit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    total_credit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    created_by: { type: DataTypes.UUID },
    posted_by: { type: DataTypes.UUID, allowNull: true }
    ,reversal_of_id: { type: DataTypes.UUID, allowNull: true }
    ,reversed_by_id: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'journal_entries',
    underscored: true,
    timestamps: true
  });
  return JournalEntry;
};
