const test = require('node:test');
const assert = require('node:assert/strict');
const production = require('../services/production.service');

test('scales a millilitre formula by variant fill and sale quantity', () => {
  assert.equal(production.calculateFormulaOutput({ output_unit: 'ml' }, { fill_quantity_ml: 50 }, 2), 100);
});

test('converts variant millilitres for a litre formula', () => {
  assert.equal(production.calculateFormulaOutput({ output_unit: 'L' }, { fill_quantity_ml: 100 }, 3), 0.3);
});

test('uses unit quantity for piece-based formulas', () => {
  assert.equal(production.calculateFormulaOutput({ output_unit: 'pcs' }, { fill_quantity_ml: null }, 4), 4);
});

test('resolves a variant formula override before the product default', () => {
  assert.equal(production.resolveVariantFormulaId({ formula_id: 'override', product: { formula_id: 'default' } }), 'override');
  assert.equal(production.resolveVariantFormulaId({ formula_id: null, product: { formula_id: 'default' } }), 'default');
});

test('combines duplicate raw and packaging requirements', () => {
  assert.deepEqual(production.combineMaterialRequirements([
    { material_type: 'raw', material_id: 'oil', required_qty: 2 },
    { material_type: 'raw', material_id: 'oil', required_qty: 3 },
    { material_type: 'packaging', material_id: 'bottle', required_qty: 1 }
  ]), [
    { material_type: 'raw', material_id: 'oil', required_qty: 5 },
    { material_type: 'packaging', material_id: 'bottle', required_qty: 1 }
  ]);
});
