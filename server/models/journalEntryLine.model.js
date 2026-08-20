module.exports = (sequelize, DataTypes) => {
  const JournalEntryLine = sequelize.define('journalEntryLine', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    journal_entry_id: { type: DataTypes.UUID },
    account_id: { type: DataTypes.UUID },
    debit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    credit: { type: DataTypes.DECIMAL(15,2), defaultValue: 0 },
    description: { type: DataTypes.TEXT, allowNull: true }
  }, {
    tableName: 'journal_entry_lines',
    underscored: true,
    timestamps: true
  });
  return JournalEntryLine;
};
