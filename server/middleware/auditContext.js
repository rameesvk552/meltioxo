const { AsyncLocalStorage } = require('async_hooks');
const { randomUUID } = require('crypto');

const storage = new AsyncLocalStorage();

const getStore = () => storage.getStore();

const updateStore = updates => {
  const store = getStore();
  if (store) Object.assign(store, updates);
  return store;
};

const requestContext = (req, res, next) => {
  storage.run({
    requestId: randomUUID(),
    method: req.method,
    route: req.originalUrl,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
    actorUserId: null,
    actorName: null,
    actorEmail: null,
    actorRole: null,
    tenantId: null,
    branchId: null
  }, next);
};

module.exports = {
  requestContext,
  getAuditContext: getStore,
  setAuditActor: user => updateStore({
    actorUserId: user?.id || null,
    actorName: user?.name || null,
    actorEmail: user?.email || null,
    actorRole: user?.role || null,
    tenantId: user?.tenant_id || undefined
  }),
  setAuditTenant: tenantId => updateStore({ tenantId: tenantId || null }),
  setAuditBranch: branchId => updateStore({ branchId: branchId || null })
};
