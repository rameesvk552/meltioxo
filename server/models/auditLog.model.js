module.exports = (sequelize, DataTypes) => sequelize.define('auditLog', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  tenant_id: { type: DataTypes.UUID, allowNull: true },
  actor_user_id: { type: DataTypes.UUID, allowNull: true },
  actor_name: { type: DataTypes.STRING, allowNull: true },
  actor_email: { type: DataTypes.STRING, allowNull: true },
  actor_role: { type: DataTypes.STRING, allowNull: true },
  action: { type: DataTypes.STRING(40), allowNull: false },
  entity_type: { type: DataTypes.STRING(100), allowNull: false },
  entity_table: { type: DataTypes.STRING(100), allowNull: true },
  entity_id: { type: DataTypes.STRING, allowNull: true },
  changes: { type: DataTypes.JSONB, allowNull: true },
  before_data: { type: DataTypes.JSONB, allowNull: true },
  after_data: { type: DataTypes.JSONB, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: true },
  request_id: { type: DataTypes.UUID, allowNull: true },
  method: { type: DataTypes.STRING(10), allowNull: true },
  route: { type: DataTypes.TEXT, allowNull: true },
  ip_address: { type: DataTypes.STRING(100), allowNull: true },
  user_agent: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'audit_logs',
  underscored: true,
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['tenant_id', 'created_at'] },
    { fields: ['tenant_id', 'entity_type', 'entity_id'] },
    { fields: ['tenant_id', 'actor_user_id', 'created_at'] },
    { fields: ['tenant_id', 'action', 'created_at'] }
  ]
});
