require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./models');
const { errorHandler } = require('./middleware/errorHandler');
const { requestContext } = require('./middleware/auditContext');

const app = express();

app.use(helmet());
app.use(cors());
// A 5 MB logo expands to roughly 6.7 MB when encoded as a data URL.
app.use(express.json({ limit: '8mb' }));
app.use(requestContext);
app.use(morgan('dev'));

// Used only by WhatsApp to fetch a time-limited signed invoice PDF.
app.use('/api/public', require('./routes/publicInvoice.routes'));

// Routes would be mounted here
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/raw-materials', require('./routes/rawMaterial.routes'));
app.use('/api/packaging-materials', require('./routes/packagingMaterial.routes'));
app.use('/api/packing-kits', require('./routes/packingKit.routes'));
app.use('/api/suppliers', require('./routes/supplier.routes'));
app.use('/api/purchases', require('./routes/directPurchase.routes'));
app.use('/api/formulas', require('./routes/formula.routes'));
app.use('/api/production-orders', require('./routes/production.routes'));
app.use('/api/products', require('./routes/product.routes'));
app.use('/api/finished-goods', require('./routes/finishedGoods.routes'));
app.use('/api/customers', require('./routes/sales.routes'));
app.use('/api/retail-sales', require('./routes/retailSale.routes'));
app.use('/api/business-days', require('./routes/businessDay.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/accounts', require('./routes/account.routes'));
app.use('/api/journal-entries', require('./routes/journal.routes'));
app.use('/api/payments', require('./routes/payment.routes'));
app.use('/api/expenses', require('./routes/expense.routes'));
app.use('/api/reports', require('./routes/report.routes'));
app.use('/api/tenant', require('./routes/tenant.routes'));
app.use('/api/branches', require('./routes/branch.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/audit-logs', require('./routes/auditLog.routes'));

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

// Existing purchase tables used enums that only allowed raw and packaging
// materials. Add finished goods before model sync so ready-made SKUs can be
// received without rebuilding or discarding any historical purchase rows.
const migratePurchaseItemEnums = async () => {
  for (const enumName of ['enum_purchase_order_items_material_type', 'enum_purchase_receipt_items_material_type']) {
    const [types] = await db.sequelize.query('SELECT 1 FROM pg_type WHERE typname = :enumName', { replacements: { enumName } });
    if (types.length) await db.sequelize.query(`ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS 'finished'`);
  }
};

// Purchases are now saved as editable drafts before they affect inventory or
// the general ledger. Preserve the existing invoice enum and add the new state.
const migratePurchaseInvoiceStatus = async () => {
  const [types] = await db.sequelize.query("SELECT 1 FROM pg_type WHERE typname = 'enum_purchase_invoices_status'");
  if (types.length) await db.sequelize.query('ALTER TYPE "enum_purchase_invoices_status" ADD VALUE IF NOT EXISTS \'draft\'');
};

// Products created before ready-made purchasing required a formula at the
// database level. Ready-made products intentionally have no formula.
const migrateProductsForReadyMade = async () => {
  const [columns] = await db.sequelize.query(`
    SELECT is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'formula_id'
  `);
  if (columns[0]?.is_nullable === 'NO') {
    await db.sequelize.query('ALTER TABLE "products" ALTER COLUMN "formula_id" DROP NOT NULL');
  }
};

// Upgrade every tenant to the same BS/PL hierarchy. Legacy ledger codes are
// renamed in place so historical journals and production balances remain linked.
const ensureDefaultAccountHierarchy = async () => {
  const { ensureChartOfAccounts } = require('./seeders/seed-chart-of-accounts');
  const accounting = require('./services/accounting.service');
  const tenants = await db.tenant.findAll({ attributes: ['id'] });
  for (const tenant of tenants) {
    await ensureChartOfAccounts(tenant.id);
    await accounting.ensureDefaultPaymentMethods(tenant.id);
    await accounting.ensureSupplierLedgers(tenant.id);
  }
};

const ensureDefaultBranches = async () => {
  const tenants = await db.tenant.findAll({ attributes: ['id', 'name'] });
  for (const item of tenants) {
    let main = await db.branch.findOne({ where: { tenant_id: item.id, is_default: true } });
    if (!main) main = await db.branch.create({ tenant_id: item.id, name: 'Main Branch', code: 'MAIN', is_default: true });
    await db.user.update({ branch_id: main.id }, { where: { tenant_id: item.id, branch_id: null } });
    for (const modelName of ['customer', 'retailSale', 'salesOrder', 'salesInvoice', 'salesReturn', 'businessDay', 'payment', 'expense', 'stockBatch', 'stockMovement', 'purchaseOrder', 'purchaseReceipt', 'purchaseInvoice', 'productionOrder', 'journalEntry']) {
      if (db[modelName]) await db[modelName].update({ branch_id: main.id }, { where: { tenant_id: item.id, branch_id: null } });
    }
  }
};

migrateRawMaterialCategoryToText().then(migratePaymentModesToText).then(migratePurchaseItemEnums).then(migratePurchaseInvoiceStatus).then(migrateProductsForReadyMade).then(() => db.sequelize.sync({ alter: true })).then(ensureDefaultBranches).then(ensureDefaultAccountHierarchy).then(() => {
  console.log('Database synced');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database: ', err);
});
