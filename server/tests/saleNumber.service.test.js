const test = require('node:test');
const assert = require('node:assert/strict');
const { sequenceFromSaleNumbers } = require('../services/saleNumber.service');

test('continues after the highest invoice number when historical sales have gaps', () => {
  const sequence = sequenceFromSaleNumbers([
    'RS-2026-0002',
    'RS-2026-0003',
    'RS-2026-0004',
    'RS-2026-0005'
  ], 2026);

  assert.equal(sequence, 6);
});

test('ignores invoice numbers from other years', () => {
  assert.equal(sequenceFromSaleNumbers(['RS-2025-0250', 'RS-2026-0003'], 2026), 4);
});
