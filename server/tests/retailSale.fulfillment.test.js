const test = require('node:test');
const assert = require('node:assert/strict');
const retailSales = require('../controllers/retailSaleV2.controller');
const db = require('../models');

test('ready-made variants are always sold from finished stock', () => {
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'ready_made' }), 'stock');
});

test('live-making and legacy variants are always made at sale time', () => {
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'live_make' }), 'make_now');
  assert.equal(retailSales.fulfillmentModeForVariant({}), 'make_now');
});

test('measured raw-material and bulk-perfume products sell from stock', () => {
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'live_make', product: { sell_by_measurement: true, measurement_source_type: 'raw_material' } }), 'stock');
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'live_make', product: { sell_by_measurement: true, measurement_source_type: 'bulk_stock' } }), 'stock');
  assert.equal(retailSales.fulfillmentModeForVariant({ source_type: 'live_make', product: { sell_by_measurement: true, measurement_source_type: 'formula' } }), 'make_now');
});

test('converts measured millilitres to the linked material stock unit', () => {
  assert.equal(retailSales.mlToMaterialQuantity(30, 'ml'), 30);
  assert.equal(retailSales.mlToMaterialQuantity(30, 'L'), 0.03);
});

test('packing kit capacity boundaries are inclusive', () => {
  const kit = { minimum_fill_ml: 10, maximum_fill_ml: 20 };
  assert.equal(retailSales.packingKitSupportsFill(kit, 10), true);
  assert.equal(retailSales.packingKitSupportsFill(kit, 20), true);
  assert.equal(retailSales.packingKitSupportsFill(kit, 9.9999), false);
  assert.equal(retailSales.packingKitSupportsFill(kit, 20.0001), false);
});

test('packing materials can be represented as first-class retail sale and return lines', () => {
  assert.equal(db.tenant.rawAttributes.packaging_material_sales_enabled.defaultValue, false);
  assert.equal(db.retailSaleItem.rawAttributes.finished_good_id.allowNull, true);
  assert.ok(db.retailSaleItem.rawAttributes.packaging_material_id);
  assert.ok(db.salesReturnItem.rawAttributes.packaging_material_id);
  assert.ok(db.packagingMaterial.rawAttributes.selling_price);
  assert.ok(db.packagingMaterial.rawAttributes.tax_rate);
});

test('summarizes partial and full returns without mutating the original sale values', () => {
  const partial = retailSales.addReturnSummary({
    total_amount: 200,
    retailSaleItems: [{ id: 'line-1', quantity: 2 }],
    salesReturns: [{ subtotal: 100, discount_amount: 10, total_amount: 99, restocked_cost: 40, salesReturnItems: [{ retail_sale_item_id: 'line-1', quantity: 1, restock_quantity: 1 }] }]
  });
  assert.equal(partial.return_status, 'partial');
  assert.equal(partial.retailSaleItems[0].returnable_quantity, 1);
  assert.equal(partial.returned_amount, 99);
  assert.equal(partial.returned_revenue, 90);
  assert.equal(partial.returned_cost, 40);

  const full = retailSales.addReturnSummary({
    retailSaleItems: partial.retailSaleItems,
    salesReturns: [{ total_amount: 200, salesReturnItems: [{ retail_sale_item_id: 'line-1', quantity: 2, restock_quantity: 0 }] }]
  });
  assert.equal(full.return_status, 'full');
  assert.equal(full.retailSaleItems[0].returnable_quantity, 0);
});
