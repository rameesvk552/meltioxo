const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const db = require('../models');
const { AppError } = require('../middleware/errorHandler');

const API_BASE_URL = String(process.env.MARKETING_OS_PARTNER_API_BASE_URL || 'http://127.0.0.1:8000/api/v1').replace(/\/+$/, '');
const PARTNER_API_KEY = process.env.MARKETING_OS_PARTNER_API_KEY || '';
const SESSION_SECRET = process.env.MARKETING_OS_SESSION_SECRET || process.env.JWT_SECRET || 'perfume_erp_marketing_os_session_secret';
const TIMEOUT_MS = Number(process.env.MARKETING_OS_TIMEOUT_MS || 20000);

const statusFromProvider = status => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'connected') return 'CONNECTED';
  if (normalized === 'pending' || normalized === 'connecting') return 'PENDING';
  if (normalized === 'error' || normalized === 'failed') return 'FAILED';
  return 'NOT_CONNECTED';
};

const providerErrorMessage = payload => payload?.message || payload?.error?.message || payload?.error || 'Marketing OS request failed';

const assertConfigured = () => {
  if (!PARTNER_API_KEY) {
    throw new AppError('Marketing OS is not configured. Set MARKETING_OS_PARTNER_API_KEY on the server.', 503);
  }
};

const marketingOsRequest = async (path, { method = 'GET', tenantToken, body, query } = {}) => {
  assertConfigured();
  const url = new URL(`${API_BASE_URL}${path}`);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': PARTNER_API_KEY,
        ...(tenantToken ? { authorization: `Bearer ${tenantToken}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const raw = await response.text();
    let payload = null;
    try { payload = raw ? JSON.parse(raw) : null; } catch { payload = { message: raw }; }

    if (!response.ok) {
      const upstreamStatus = response.status >= 400 && response.status < 500 ? response.status : 502;
      const error = new AppError(providerErrorMessage(payload), upstreamStatus);
      error.code = payload?.code || 'MARKETING_OS_REQUEST_FAILED';
      error.details = payload?.errors || payload?.details || null;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') throw new AppError('Marketing OS did not respond in time.', 504);
    if (error instanceof AppError) throw error;
    throw new AppError(`Could not reach Marketing OS: ${error.message}`, 502);
  } finally {
    clearTimeout(timer);
  }
};

const findRemoteTenantByEmail = async email => {
  if (!email) return null;
  const response = await marketingOsRequest('/tenants', { query: { search: email, limit: 100 } });
  const tenants = response?.data?.tenants || [];
  return tenants.find(item => String(item.email || '').toLowerCase() === String(email).toLowerCase()) || null;
};

const resolveRemoteTenant = async localTenant => {
  if (localTenant.marketing_os_tenant_id) return localTenant.marketing_os_tenant_id;

  const internalEmail = `tenant-${localTenant.id}@perfume-erp.internal`;
  for (const email of [localTenant.email, internalEmail].filter(Boolean)) {
    const existing = await findRemoteTenantByEmail(email);
    if (existing?.tenantId) {
      await localTenant.update({ marketing_os_tenant_id: existing.tenantId });
      return existing.tenantId;
    }
  }

  let lastError;
  for (const email of [localTenant.email, internalEmail].filter(Boolean)) {
    try {
      const response = await marketingOsRequest('/tenants', {
        method: 'POST',
        body: {
          name: localTenant.name || 'Perfume ERP Business',
          email,
          phone: localTenant.phone || undefined,
          metadata: {
            source: 'perfume_erp',
            tenantId: localTenant.id,
            businessEmail: localTenant.email || null,
          },
        },
      });
      const tenantId = response?.data?.tenantId;
      if (tenantId) {
        await localTenant.update({ marketing_os_tenant_id: tenantId });
        return tenantId;
      }
    } catch (error) {
      lastError = error;
      const existing = await findRemoteTenantByEmail(email).catch(() => null);
      if (existing?.tenantId) {
        await localTenant.update({ marketing_os_tenant_id: existing.tenantId });
        return existing.tenantId;
      }
    }
  }

  if (lastError) throw lastError;
  throw new AppError('Marketing OS tenant creation did not return a tenant ID.', 502);
};

const getTenantToken = async marketingOsTenantId => {
  const response = await marketingOsRequest(`/tenants/${encodeURIComponent(marketingOsTenantId)}/token`, { method: 'POST' });
  const token = response?.data?.token;
  if (!token) throw new AppError('Marketing OS did not return a tenant token.', 502);
  return token;
};

const serializeChannel = channel => ({
  id: channel.id,
  providerConnectionId: channel.provider_connection_id,
  provider: channel.provider,
  status: channel.status,
  onboardingMode: channel.onboarding_mode,
  businessAccountId: channel.business_account_id,
  phoneNumberId: channel.phone_number_id,
  displayPhoneNumber: channel.display_phone_number,
  label: channel.label,
  isDefault: channel.is_default,
  errorMessage: channel.error_message,
  coexistence: {
    enabled: channel.onboarding_mode === 'COEXISTENCE',
    contactSyncStatus: channel.contact_sync_status,
    historySyncStatus: channel.history_sync_status,
  },
  lastSyncedAt: channel.last_synced_at,
});

const serializeConnection = (tenant, channels, syncWarning = null) => ({
  provider: tenant.whatsapp_provider || 'MARKETING_OS',
  status: tenant.whatsapp_connection_status || 'NOT_CONNECTED',
  channelId: tenant.whatsapp_channel_id || null,
  businessAccountId: tenant.whatsapp_business_account_id || null,
  phoneNumberId: tenant.whatsapp_phone_number_id || null,
  displayPhoneNumber: tenant.whatsapp_display_phone_number || null,
  marketingOsTenantId: tenant.marketing_os_tenant_id || null,
  onboardingMode: tenant.whatsapp_onboarding_mode || 'STANDARD',
  errorMessage: tenant.whatsapp_connection_error || null,
  lastSyncedAt: tenant.whatsapp_last_synced_at || null,
  coexistence: {
    enabled: tenant.whatsapp_onboarding_mode === 'COEXISTENCE' || tenant.whatsapp_coexistence_status === 'ACTIVE',
    status: tenant.whatsapp_coexistence_status || 'NOT_ENABLED',
    contactSyncStatus: tenant.whatsapp_contact_sync_status || 'NOT_STARTED',
    historySyncStatus: tenant.whatsapp_history_sync_status || 'NOT_STARTED',
    lastSyncedAt: tenant.whatsapp_coexistence_last_synced_at || null,
  },
  channels: channels.map(serializeChannel),
  syncWarning,
});

const listCachedChannels = tenantId => db.whatsappChannel.findAll({
  where: { tenant_id: tenantId, is_active: true },
  order: [['is_default', 'DESC'], ['createdAt', 'ASC']],
});

const updateTenantDefault = async (tenant, channels) => {
  const defaultChannel = channels.find(channel => channel.is_default) || channels[0] || null;
  if (!defaultChannel) {
    await tenant.update({
      whatsapp_connection_status: 'NOT_CONNECTED',
      whatsapp_channel_id: null,
      whatsapp_business_account_id: null,
      whatsapp_phone_number_id: null,
      whatsapp_display_phone_number: null,
      whatsapp_connection_error: null,
      whatsapp_last_synced_at: new Date(),
    });
    return;
  }

  await tenant.update({
    whatsapp_provider: 'MARKETING_OS',
    whatsapp_connection_status: defaultChannel.status,
    whatsapp_channel_id: defaultChannel.id,
    whatsapp_business_account_id: defaultChannel.business_account_id,
    whatsapp_phone_number_id: defaultChannel.phone_number_id,
    whatsapp_display_phone_number: defaultChannel.display_phone_number,
    whatsapp_onboarding_mode: defaultChannel.onboarding_mode,
    whatsapp_connection_error: defaultChannel.error_message,
    whatsapp_last_synced_at: new Date(),
  });
};

const upsertRemoteChannel = async (tenant, remote, defaults = {}) => {
  const where = remote.id
    ? { tenant_id: tenant.id, provider_connection_id: String(remote.id) }
    : { tenant_id: tenant.id, phone_number_id: String(remote.phoneNumberId || '') };
  let channel = await db.whatsappChannel.findOne({ where });
  if (!channel && remote.phoneNumberId) {
    channel = await db.whatsappChannel.findOne({ where: { tenant_id: tenant.id, phone_number_id: String(remote.phoneNumberId) } });
  }
  const values = {
    tenant_id: tenant.id,
    provider_connection_id: String(remote.id || channel?.provider_connection_id || remote.phoneNumberId),
    provider: 'MARKETING_OS',
    status: statusFromProvider(remote.status),
    onboarding_mode: defaults.onboardingMode || channel?.onboarding_mode || 'STANDARD',
    marketing_os_tenant_id: tenant.marketing_os_tenant_id,
    business_account_id: remote.whatsappBusinessAccountId || null,
    phone_number_id: remote.phoneNumberId || null,
    display_phone_number: remote.displayPhoneNumber || null,
    label: defaults.label || channel?.label || remote.businessName || null,
    is_default: Boolean(remote.isDefault),
    is_active: true,
    error_message: remote.errorMessage || null,
    contact_sync_status: defaults.contactSyncStatus || channel?.contact_sync_status || 'NOT_STARTED',
    history_sync_status: defaults.historySyncStatus || channel?.history_sync_status || 'NOT_STARTED',
    last_synced_at: new Date(),
  };
  if (channel) return channel.update(values);
  return db.whatsappChannel.create(values);
};

const syncRemoteChannels = async (tenant, tenantToken) => {
  const response = await marketingOsRequest('/whatsapp/settings/connections', { tenantToken });
  const remoteChannels = response?.data || [];
  const remoteIds = [];
  for (const remote of remoteChannels) {
    const channel = await upsertRemoteChannel(tenant, remote, {
      onboardingMode: remote.phoneNumberId === tenant.whatsapp_phone_number_id ? tenant.whatsapp_onboarding_mode : undefined,
    });
    remoteIds.push(channel.provider_connection_id);
  }
  await db.whatsappChannel.update(
    { is_active: false, is_default: false },
    { where: { tenant_id: tenant.id, provider_connection_id: { [Op.notIn]: remoteIds.length ? remoteIds : [''] } } },
  );
  const channels = await listCachedChannels(tenant.id);
  await updateTenantDefault(tenant, channels);
  return channels;
};

const getConnection = async tenantId => {
  const tenant = await db.tenant.findByPk(tenantId);
  if (!tenant) throw new AppError('Tenant not found.', 404);

  let channels = await listCachedChannels(tenant.id);
  let syncWarning = null;
  if (tenant.marketing_os_tenant_id && PARTNER_API_KEY) {
    try {
      const token = await getTenantToken(tenant.marketing_os_tenant_id);
      channels = await syncRemoteChannels(tenant, token);
      await tenant.reload();
    } catch (error) {
      syncWarning = `Showing the last saved channel state because Marketing OS could not be refreshed: ${error.message}`;
    }
  }
  return serializeConnection(tenant, channels, syncWarning);
};

const startConnection = async (tenantId, options = {}) => {
  const tenant = await db.tenant.findByPk(tenantId);
  if (!tenant) throw new AppError('Tenant not found.', 404);
  const mode = options.onboardingMode === 'coexistence' ? 'COEXISTENCE' : 'STANDARD';
  const isCoexistence = mode === 'COEXISTENCE';

  await tenant.update({
    whatsapp_provider: 'MARKETING_OS',
    whatsapp_connection_status: 'PENDING',
    whatsapp_onboarding_mode: mode,
    whatsapp_connection_error: null,
    whatsapp_coexistence_status: isCoexistence ? 'PENDING' : 'NOT_ENABLED',
    whatsapp_contact_sync_status: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    whatsapp_history_sync_status: isCoexistence ? 'PENDING' : 'NOT_STARTED',
  });

  try {
    const marketingOsTenantId = await resolveRemoteTenant(tenant);
    const tenantToken = await getTenantToken(marketingOsTenantId);
    const featureType = isCoexistence ? 'whatsapp_business_app_onboarding' : undefined;
    const configResponse = await marketingOsRequest('/whatsapp/settings/embedded/config', {
      tenantToken,
      query: { featureType, sessionInfoVersion: '3' },
    });
    const embeddedConfig = configResponse?.data;
    if (!embeddedConfig?.appId) throw new AppError('Marketing OS embedded signup is not configured for this environment.', 502);

    const sessionToken = jwt.sign({
      localTenantId: tenant.id,
      marketingOsTenantId,
      state: embeddedConfig.state,
      onboardingMode: mode,
      featureType: featureType || null,
    }, SESSION_SECRET, { expiresIn: '15m' });

    const channels = await listCachedChannels(tenant.id);
    const connection = serializeConnection(tenant, channels);
    return {
      ...connection,
      sessionToken,
      embeddedSignup: {
        appId: embeddedConfig.appId,
        configId: embeddedConfig.configId || null,
        sessionToken,
        featureType: featureType || null,
        sessionInfoVersion: '3',
      },
    };
  } catch (error) {
    await tenant.update({ whatsapp_connection_status: 'FAILED', whatsapp_connection_error: error.message });
    throw error;
  }
};

const beginCoexistenceSync = async (tenant, tenantToken) => {
  if (!tenant.whatsapp_phone_number_id) {
    await tenant.update({
      whatsapp_contact_sync_status: 'FAILED',
      whatsapp_history_sync_status: 'FAILED',
      whatsapp_connection_error: 'Cannot sync the Business App until Meta returns a phone number ID.',
    });
    return;
  }
  const base = {
    tenantId: tenant.marketing_os_tenant_id,
    phoneNumberId: tenant.whatsapp_phone_number_id,
    messaging_product: 'whatsapp',
  };
  try {
    await marketingOsRequest('/whatsapp/smb-app-data', { tenantToken, method: 'POST', body: { ...base, sync_type: 'smb_app_state_sync' } });
    await marketingOsRequest('/whatsapp/smb-app-data', { tenantToken, method: 'POST', body: { ...base, sync_type: 'history' } });
    await tenant.update({
      whatsapp_contact_sync_status: 'PENDING',
      whatsapp_history_sync_status: 'PENDING',
      whatsapp_coexistence_last_synced_at: new Date(),
      whatsapp_connection_error: null,
    });
  } catch (error) {
    await tenant.update({
      whatsapp_contact_sync_status: 'FAILED',
      whatsapp_history_sync_status: 'FAILED',
      whatsapp_coexistence_last_synced_at: new Date(),
      whatsapp_connection_error: error.message,
    });
  }
};

const completeConnection = async (tenantId, payload = {}) => {
  if (!payload.sessionToken || !payload.code) throw new AppError('The Meta authorization code and setup session are required.', 400);
  let session;
  try { session = jwt.verify(payload.sessionToken, SESSION_SECRET); }
  catch { throw new AppError('The WhatsApp setup session is invalid or expired. Start the connection again.', 401); }
  if (session.localTenantId !== tenantId) throw new AppError('This WhatsApp setup session belongs to another tenant.', 403);

  const tenant = await db.tenant.findByPk(tenantId);
  if (!tenant) throw new AppError('Tenant not found.', 404);
  try {
    const tenantToken = await getTenantToken(session.marketingOsTenantId);
    const response = await marketingOsRequest('/whatsapp/settings/embedded/complete', {
      tenantToken,
      method: 'POST',
      body: {
        code: payload.code,
        state: session.state,
        featureType: session.featureType || undefined,
        sessionInfoVersion: '3',
        phoneNumberId: payload.phoneNumberId || payload.sessionInfo?.phone_number_id,
        wabaId: payload.wabaId || payload.sessionInfo?.waba_id,
        businessId: payload.businessId || payload.sessionInfo?.business_id,
        sessionInfo: payload.sessionInfo || null,
      },
    });
    const providerConnection = response?.data?.connection;
    if (!providerConnection?.id) throw new AppError('Marketing OS completed signup without returning a connection.', 502);
    const mode = session.onboardingMode || 'STANDARD';
    const isCoexistence = mode === 'COEXISTENCE';
    const channel = await upsertRemoteChannel(tenant, { ...providerConnection, isDefault: true }, {
      onboardingMode: mode,
      contactSyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
      historySyncStatus: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    });
    await db.whatsappChannel.update({ is_default: false }, { where: { tenant_id: tenant.id, id: { [Op.ne]: channel.id } } });
    await channel.update({ is_default: true });
    const status = statusFromProvider(providerConnection.status);
    await tenant.update({
      whatsapp_provider: 'MARKETING_OS',
      whatsapp_connection_status: status,
      marketing_os_tenant_id: session.marketingOsTenantId,
      whatsapp_channel_id: channel.id,
      whatsapp_business_account_id: providerConnection.whatsappBusinessAccountId || null,
      whatsapp_phone_number_id: providerConnection.phoneNumberId || null,
      whatsapp_display_phone_number: providerConnection.displayPhoneNumber || null,
      whatsapp_onboarding_mode: mode,
      whatsapp_connection_error: providerConnection.errorMessage || null,
      whatsapp_last_synced_at: new Date(),
      whatsapp_coexistence_status: isCoexistence && status === 'CONNECTED' ? 'ACTIVE' : isCoexistence ? 'PENDING' : 'NOT_ENABLED',
      whatsapp_contact_sync_status: isCoexistence ? 'PENDING' : 'NOT_STARTED',
      whatsapp_history_sync_status: isCoexistence ? 'PENDING' : 'NOT_STARTED',
    });
    if (isCoexistence) await beginCoexistenceSync(tenant, tenantToken);
    return getConnection(tenant.id);
  } catch (error) {
    await tenant.update({ whatsapp_connection_status: 'FAILED', whatsapp_connection_error: error.message });
    throw error;
  }
};

const disconnectChannel = async (tenantId, channelId) => {
  const tenant = await db.tenant.findByPk(tenantId);
  if (!tenant) throw new AppError('Tenant not found.', 404);
  const channel = await db.whatsappChannel.findOne({ where: { id: channelId, tenant_id: tenantId, is_active: true } });
  if (!channel) throw new AppError('WhatsApp channel not found.', 404);
  const tenantToken = await getTenantToken(channel.marketing_os_tenant_id);
  await marketingOsRequest(`/whatsapp/settings/${encodeURIComponent(channel.provider_connection_id)}`, { method: 'DELETE', tenantToken });
  await channel.update({ is_active: false, is_default: false, status: 'NOT_CONNECTED', last_synced_at: new Date() });
  const channels = await syncRemoteChannels(tenant, tenantToken);
  return serializeConnection(tenant, channels);
};

module.exports = {
  getConnection,
  startConnection,
  completeConnection,
  disconnectChannel,
  _private: { statusFromProvider, serializeChannel },
};
