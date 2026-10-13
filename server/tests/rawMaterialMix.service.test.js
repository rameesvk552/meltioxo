const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../models');
const { createMix } = require('../services/rawMaterialMix.service');
const { createRawMaterialMixSchema } = require('../validators/rawMaterialMix.validator');

const ids = {
  a: '11111111-1111-4111-8111-111111111111',
  b: '22222222-2222-4222-8222-222222222222',
  out: '33333333-3333-4333-8333-333333333333',
  fresh: '44444444-4444-4444-8444-444444444444'
};

const row = values => ({ ...values, async update(changes) { Object.assign(this, changes); return this; } });

const withInventory = async (run, enabled = true) => {
  const original = {
    transaction: db.sequelize.transaction,
    tenantFind: db.tenant.findByPk,
    materialFind: db.rawMaterial.findOne,
    materialCount: db.rawMaterial.count,
    materialCreate: db.rawMaterial.create,
    batchFind: db.stockBatch.findAll,
    batchCreate: db.stockBatch.create,
    movementCreate: db.stockMovement.create,
    mixFind: db.rawMaterialMix.findOne,
    mixCreate: db.rawMaterialMix.create
  };
  const materials = new Map([
    [ids.a, row({ id: ids.a, name: 'Oil', unit: 'L', current_stock: 10, reserved_stock: 0, avg_cost: 5 })],
    [ids.b, row({ id: ids.b, name: 'Alcohol', unit: 'L', current_stock: 5, reserved_stock: 0, avg_cost: 7 })],
    [ids.out, row({ id: ids.out, name: 'Blend', unit: 'L', current_stock: 1, reserved_stock: 0, avg_cost: 8 })]
  ]);
  const batches = [
    row({ id: 'batch-a', material_id: ids.a, remaining_qty: 2, cost_per_unit: 4 }),
    row({ id: 'batch-b', material_id: ids.b, remaining_qty: 2, cost_per_unit: 7 })
  ];
  const movements = [];
  const outputBatches = [];
  let savedMix;
  try {
    db.sequelize.transaction = async callback => callback({ LOCK: { UPDATE: 'UPDATE' } });
    db.tenant.findByPk = async () => ({ raw_material_mixing_enabled: enabled });
    db.rawMaterial.findOne = async ({ where }) => materials.get(where.id) || null;
    db.rawMaterial.count = async () => materials.size;
    db.rawMaterial.create = async values => { const material = row({ id: ids.fresh, ...values }); materials.set(material.id, material); return material; };
    db.stockBatch.findAll = async ({ where }) => batches.filter(batch => batch.material_id === where.material_id);
    db.stockBatch.create = async values => { const batch = row({ id: 'output-batch', ...values }); outputBatches.push(batch); return batch; };
    db.stockMovement.create = async values => { movements.push(values); return values; };
    db.rawMaterialMix.findOne = async () => null;
    db.rawMaterialMix.create = async values => { savedMix = values; return values; };
    await run({ materials, batches, movements, outputBatches, getMix: () => savedMix });
  } finally {
    db.sequelize.transaction = original.transaction;
    db.tenant.findByPk = original.tenantFind;
    db.rawMaterial.findOne = original.materialFind;
    db.rawMaterial.count = original.materialCount;
    db.rawMaterial.create = original.materialCreate;
    db.stockBatch.findAll = original.batchFind;
    db.stockBatch.create = original.batchCreate;
    db.stockMovement.create = original.movementCreate;
    db.rawMaterialMix.findOne = original.mixFind;
    db.rawMaterialMix.create = original.mixCreate;
  }
};

const request = {
  tenantId: 'tenant', branchId: 'branch', userId: 'user', requestKey: 'mix-one',
  data: { output_material_id: ids.out, output_quantity: 3, ingredients: [
    { material_id: ids.a, quantity: 3 }, { material_id: ids.b, quantity: 2 }
  ] }
};

test('mix deducts FIFO and opening stock, then receives output at combined cost', async () => {
  await withInventory(async ({ materials, batches, movements, outputBatches, getMix }) => {
    const result = await createMix(request);
    assert.equal(materials.get(ids.a).current_stock, 7);
    assert.equal(materials.get(ids.b).current_stock, 3);
    assert.equal(materials.get(ids.out).current_stock, 4);
    assert.equal(materials.get(ids.out).avg_cost, 8.75);
    assert.equal(batches[0].remaining_qty, 0);
    assert.equal(batches[1].remaining_qty, 0);
    assert.equal(outputBatches[0].cost_per_unit, 9);
    assert.deepEqual(movements.map(item => [item.direction, item.quantity, item.total_cost]), [
      ['out', 2, 8], ['out', 1, 5], ['out', 2, 14], ['in', 3, 27]
    ]);
    assert.equal(getMix().total_cost, 27);
    assert.equal(result.mix.ingredients.length, 2);
  });
});

test('mix rejects insufficient available stock before any movement', async () => {
  await withInventory(async ({ materials, movements }) => {
    materials.get(ids.a).reserved_stock = 8;
    await assert.rejects(createMix(request), /Insufficient available stock/);
    assert.equal(materials.get(ids.a).current_stock, 10);
    assert.equal(movements.length, 0);
  });
});

test('mix does not receive into negative output stock', async () => {
  await withInventory(async ({ materials, movements }) => {
    materials.get(ids.out).current_stock = -3;
    await assert.rejects(createMix(request), /Reconcile negative stock/);
    assert.equal(materials.get(ids.a).current_stock, 10);
    assert.equal(movements.length, 0);
  });
});

test('mix can create and receive a new raw material in the same operation', async () => {
  await withInventory(async ({ materials, movements, getMix }) => {
    const result = await createMix({ ...request, data: {
      new_material: { name: 'Prepared base', category: 'Blend', unit: 'L' },
      output_quantity: 3,
      ingredients: request.data.ingredients
    } });
    assert.equal(result.output.id, ids.fresh);
    assert.equal(materials.get(ids.fresh).current_stock, 3);
    assert.equal(materials.get(ids.fresh).avg_cost, 9);
    assert.equal(getMix().output_material_id, ids.fresh);
    assert.equal(movements.at(-1).material_id, ids.fresh);
  });
});

test('company setting blocks mixing when disabled', async () => {
  await withInventory(async ({ movements }) => {
    await assert.rejects(createMix(request), /Enable raw material mixing/);
    assert.equal(movements.length, 0);
  }, false);
});

test('mix validation rejects duplicate inputs and self-consumption', () => {
  const base = request.data;
  assert.equal(createRawMaterialMixSchema.safeParse({ ...base, ingredients: [base.ingredients[0], base.ingredients[0]] }).success, false);
  assert.equal(createRawMaterialMixSchema.safeParse({ ...base, output_material_id: ids.a }).success, false);
});
