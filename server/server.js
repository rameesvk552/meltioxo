require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./models');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes would be mounted here
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/raw-materials', require('./routes/rawMaterial.routes'));
app.use('/api/packaging-materials', require('./routes/packagingMaterial.routes'));
app.use('/api/suppliers', require('./routes/supplier.routes'));
app.use('/api/purchases', require('./routes/directPurchase.routes'));
app.use('/api/formulas', require('./routes/formula.routes'));
app.use('/api/production-orders', require('./routes/production.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/finished-goods', require('./routes/finishedGoods.routes'));
app.use('/api/customers', require('./routes/sales.routes'));
app.use('/api/retail-sales', require('./routes/retailSale.routes'));
app.use('/api/accounts', require('./routes/account.routes'));
app.use('/api/journal-entries', require('./routes/journal.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/tenant', require('./routes/tenant.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Convert installations created with the former fixed PostgreSQL enum to text.
// This preserves existing categories and lets tenants add any category they need.
const migrateRawMaterialCategoryToText = async () => {
  const [columns] = await db.sequelize.query(`
    SELECT udt_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'raw_materials'
      AND column_name = 'category'
  `);

  if (columns[0]?.udt_name === 'enum_raw_materials_category') {
    await db.sequelize.query(`
      ALTER TABLE raw_materials
      ALTER COLUMN category TYPE VARCHAR(100)
      USING category::text
    `);
  }
};

// Payment methods are tenant-configurable (Cash, bank, UPI, gateway, wallet, etc.).
// Older installations used fixed PostgreSQL enums, so widen those columns before sync.
const migratePaymentModesToText = async () => {
  for (const table of ['payments', 'expenses']) {
    const [columns] = await db.sequelize.query(`
      SELECT data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = :table AND column_name = 'payment_mode'
    `, { replacements: { table } });
    if (columns[0]?.data_type === 'USER-DEFINED') {
      await db.sequelize.query(`ALTER TABLE "${table}" ALTER COLUMN payment_mode TYPE VARCHAR(30) USING payment_mode::text`);
    }
  }
};

// Existing tenants were seeded before Cash & Bank became a parent group. Bring those
// ledgers into the same selectable hierarchy without changing their balances.
const ensureCashBankHierarchy = async () => {
  const tenants = await db.tenant.findAll({ attributes: ['id'] });
  for (const tenant of tenants) {
    let group = await db.account.findOne({ where: { tenant_id: tenant.id, code: '1000' } });
    if (!group) group = await db.account.create({ tenant_id: tenant.id, code: '1000', name: 'Cash & Bank', type: 'asset', is_system: true, is_group: true });
    else await group.update({ name: group.name === 'Cash' ? 'Cash & Bank' : group.name, is_group: true });
    // Match Travel Bot's lean setup: only Cash exists by default. Tenants add
    // their real bank/UPI/card ledgers and map payment methods when needed.
    const defaults = [['1001', 'Cash in Hand']];
    for (const [code, name] of defaults) {
      const ledger = await db.account.findOne({ where: { tenant_id: tenant.id, code } });
      if (ledger) await ledger.update({ parent_id: group.id });
      else await db.account.create({ tenant_id: tenant.id, code, name, type: 'asset', parent_id: group.id, is_system: true });
    }
    const inputTax = await db.account.findOne({ where: { tenant_id: tenant.id, code: '1110' } });
    if (!inputTax) await db.account.create({ tenant_id: tenant.id, code: '1110', name: 'Input Tax Recoverable', type: 'asset', is_system: true });
    await require('./services/accounting.service').ensureDefaultPaymentMethods(tenant.id);
  }
};

migrateRawMaterialCategoryToText().then(migratePaymentModesToText).then(() => db.sequelize.sync({ alter: true })).then(ensureCashBankHierarchy).then(() => {
  console.log('Database synced');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database: ', err);
});
