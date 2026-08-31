const test = require('node:test');
const assert = require('node:assert/strict');
const { changedFields, sanitize } = require('../services/audit.service');

test('audit snapshots redact credentials and tokens', () => {
  assert.deepEqual(sanitize({
    password: 'plain-text',
    password_hash: 'hash',
    refreshToken: 'refresh-secret',
    nested: { access_token: 'access-secret', name: 'Visible' }
  }), {
    password: '[REDACTED]',
    password_hash: '[REDACTED]',
    refreshToken: '[REDACTED]',
    nested: { access_token: '[REDACTED]', name: 'Visible' }
  });
});

test('audit changes identify additions, edits, and removals', () => {
  assert.deepEqual(changedFields(
    { name: 'Old name', quantity: 1, removed: 'yes' },
    { name: 'New name', quantity: 2, added: 'yes' }
  ), {
    name: { from: 'Old name', to: 'New name' },
    quantity: { from: 1, to: 2 },
    removed: { from: 'yes', to: null },
    added: { from: null, to: 'yes' }
  });
});
