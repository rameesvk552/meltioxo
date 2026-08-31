const test = require('node:test');
const assert = require('node:assert/strict');
const { _private } = require('../services/marketingOs.service');

test('maps Marketing OS connection states to ERP states', () => {
  assert.equal(_private.statusFromProvider('connected'), 'CONNECTED');
  assert.equal(_private.statusFromProvider('connecting'), 'PENDING');
  assert.equal(_private.statusFromProvider('error'), 'FAILED');
  assert.equal(_private.statusFromProvider('disconnected'), 'NOT_CONNECTED');
});

test('serializes a cached coexistence channel without provider credentials', () => {
  const serialized = _private.serializeChannel({
    id: 'local-channel',
    provider_connection_id: 'marketing-os-channel',
    provider: 'MARKETING_OS',
    status: 'CONNECTED',
    onboarding_mode: 'COEXISTENCE',
    business_account_id: 'waba-1',
    phone_number_id: 'phone-1',
    display_phone_number: '+91 90000 00000',
    label: 'Main number',
    is_default: true,
    error_message: null,
    contact_sync_status: 'PENDING',
    history_sync_status: 'PENDING',
    last_synced_at: new Date('2026-08-29T00:00:00.000Z'),
    access_token: 'must-not-leak',
  });

  assert.equal(serialized.providerConnectionId, 'marketing-os-channel');
  assert.equal(serialized.coexistence.enabled, true);
  assert.equal(serialized.coexistence.contactSyncStatus, 'PENDING');
  assert.equal('accessToken' in serialized, false);
  assert.equal('access_token' in serialized, false);
});
