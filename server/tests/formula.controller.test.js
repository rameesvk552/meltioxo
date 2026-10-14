const test = require('node:test');
const assert = require('node:assert/strict');
const formulaController = require('../controllers/formula.controller');

test('allows millilitre formula output without an extra confirmation', () => {
  assert.doesNotThrow(() => formulaController.validateOutputSafety(30, 'ml', false));
});

test('requires explicit confirmation for litre formula output', () => {
  assert.throws(
    () => formulaController.validateOutputSafety(30, 'L', false),
    /Confirm the litre batch size/
  );
  assert.doesNotThrow(() => formulaController.validateOutputSafety(30, 'L', true));
});

test('rejects unsupported or invalid formula output values', () => {
  assert.throws(() => formulaController.validateOutputSafety(30, 'kg', true), /millilitres.*litres/);
  assert.throws(() => formulaController.validateOutputSafety(0, 'ml', false), /greater than zero/);
});
