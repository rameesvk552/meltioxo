const { getAuditContext } = require('../middleware/auditContext');

const SENSITIVE_KEYS = new Set([
  'password', 'password_hash', 'token', 'refresh_token', 'refreshtoken',
  'access_token', 'accesstoken', 'secret', 'authorization'
]);

const sanitize = (value, seen = new WeakSet()) => {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return '[REDACTED_BINARY]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) return value.map(item => sanitize(item, seen));

  return Object.entries(value).reduce((result, [key, item]) => {
    result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : sanitize(item, seen);
    return result;
  }, {});
};

const plain = value => {
  if (!value) return null;
  if (typeof value.get === 'function') return sanitize(value.get({ plain: true }));
  return sanitize(value);
};

const changedFields = (before, after) => {
  const oldData = before || {};
  const newData = after || {};
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changes = {};
  keys.forEach(key => {
    if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
      changes[key] = { from: oldData[key] ?? null, to: newData[key] ?? null };
    }
  });
  return changes;
};

const entityTypeFor = model => model.options?.auditEntityType || model.name;
const isAuditModel = model => model.name === 'auditLog';
const shouldSkip = options => Boolean(options?.skipAudit || options?.transaction?.finished);

const writeAudit = async ({
  action,
  model,
  before,
  after,
  instance,
  options = {},
  metadata = null,
  entityType = null,
  entityId = null,
  tenantId = null
}) => {
  const db = require('../models');
  if (!db.auditLog || isAuditModel(model) || shouldSkip(options)) return;

  const context = getAuditContext() || {};
  const beforeData = plain(before);
  const afterData = plain(after || instance);
  const resolvedTenantId = afterData?.tenant_id || beforeData?.tenant_id || context.tenantId || null;
  const resolvedEntityId = entityId || afterData?.id || beforeData?.id || instance?.id || null;

  await db.auditLog.create({
    tenant_id: resolvedTenantId,
    actor_user_id: context.actorUserId || null,
    actor_name: context.actorName || null,
    actor_email: context.actorEmail || null,
    actor_role: context.actorRole || null,
    action,
    entity_type: entityType || entityTypeFor(model),
    entity_table: model?.tableName || null,
    entity_id: resolvedEntityId ? String(resolvedEntityId) : null,
    changes: changedFields(beforeData, afterData),
    before_data: beforeData,
    after_data: afterData,
    metadata: sanitize(metadata),
    request_id: context.requestId || null,
    method: context.method || null,
    route: context.route || null,
    ip_address: context.ipAddress || null,
    user_agent: context.userAgent || null
  }, { transaction: options.transaction, skipAudit: true });
};

const recordAudit = async ({
  action,
  entityType,
  entityId = null,
  tenantId = null,
  before = null,
  after = null,
  metadata = null,
  transaction = null
}) => writeAudit({
  action,
  model: { name: entityType, tableName: null, options: {} },
  before,
  after,
  metadata,
  entityType,
  entityId,
  tenantId,
  options: { transaction },
  instance: null
});

const attachAuditHooks = db => {
  Object.values(db).forEach(model => {
    if (!model?.addHook || !model?.name || model.name === 'auditLog' || model.name === 'Sequelize') return;

    model.addHook('afterCreate', 'auditAfterCreate', (instance, options) => writeAudit({
      action: 'create', model, after: instance, instance, options
    }));

    model.addHook('beforeUpdate', 'auditBeforeUpdate', instance => {
      instance.__auditBefore = plain(instance);
    });
    model.addHook('afterUpdate', 'auditAfterUpdate', (instance, options) => {
      const before = instance.__auditBefore || instance._previousDataValues;
      delete instance.__auditBefore;
      return writeAudit({ action: 'update', model, before, after: instance, instance, options });
    });

    model.addHook('afterDestroy', 'auditAfterDestroy', (instance, options) => writeAudit({
      action: 'delete', model, before: instance, instance, options
    }));

    model.addHook('afterBulkCreate', 'auditAfterBulkCreate', (instances, options) => {
      if (options.individualHooks || shouldSkip(options)) return;
      return Promise.all(instances.map(instance => writeAudit({
        action: 'create', model, after: instance, instance, options
      })));
    });

    model.addHook('beforeBulkUpdate', 'auditBeforeBulkUpdate', async options => {
      if (options.individualHooks || shouldSkip(options) || !options.where) return;
      options.__auditBefore = await model.findAll({ where: options.where, transaction: options.transaction });
    });
    model.addHook('afterBulkUpdate', 'auditAfterBulkUpdate', async options => {
      if (options.individualHooks || shouldSkip(options) || !options.__auditBefore?.length) return;
      const ids = options.__auditBefore.map(instance => instance.get('id')).filter(Boolean);
      const afterRows = await model.findAll({
        where: ids.length ? { id: ids } : options.where,
        transaction: options.transaction
      });
      const afterById = new Map(afterRows.map(instance => [String(instance.get('id')), instance]));
      return Promise.all(options.__auditBefore.map(before => {
        const after = afterById.get(String(before.get('id')));
        return after ? writeAudit({ action: 'update', model, before, after, options }) : null;
      }));
    });

    model.addHook('beforeBulkDestroy', 'auditBeforeBulkDestroy', async options => {
      if (options.individualHooks || shouldSkip(options) || !options.where) return;
      options.__auditBefore = await model.findAll({ where: options.where, transaction: options.transaction });
    });
    model.addHook('afterBulkDestroy', 'auditAfterBulkDestroy', options => {
      if (options.individualHooks || shouldSkip(options) || !options.__auditBefore?.length) return;
      return Promise.all(options.__auditBefore.map(before => writeAudit({
        action: 'delete', model, before, options
      })));
    });
  });
};

module.exports = { attachAuditHooks, recordAudit, sanitize, changedFields };
