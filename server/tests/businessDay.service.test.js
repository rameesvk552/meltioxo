const test = require('node:test');
const assert = require('node:assert/strict');
const businessDays = require('../services/businessDay.service');

test('uses the India calendar date after local midnight', () => {
  assert.equal(
    businessDays.businessDate(new Date('2026-08-21T18:31:00.000Z'), 'Asia/Kolkata'),
    '2026-08-22'
  );
});

test('keeps the previous India date before local midnight', () => {
  assert.equal(
    businessDays.businessDate(new Date('2026-08-21T18:29:00.000Z'), 'Asia/Kolkata'),
    '2026-08-21'
  );
});

test('rounds register amounts to currency precision', () => {
  assert.equal(businessDays.money(100.005), 100.01);
  assert.equal(businessDays.money(0), 0);
});
