const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/database.js')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js'
    );
  })
  .forEach(file => {
    const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
    db[model.name] = model;
  });

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// Define Associations based on requirements
// Tenant associations
const tenantHasMany = ['user', 'rawMaterial', 'packagingMaterial', 'product', 'finishedGood', 'supplier', 'purchaseOrder', 'formula', 'productionOrder', 'customer', 'salesOrder', 'account', 'journalEntry', 'paymentMethod', 'payment', 'expense'];
tenantHasMany.forEach(model => {
    if(db.tenant && db[model]) {
        db.tenant.hasMany(db[model], { foreignKey: 'tenant_id' });
        db[model].belongsTo(db.tenant, { foreignKey: 'tenant_id' });
    }
});

if(db.purchaseOrder && db.supplier) db.purchaseOrder.belongsTo(db.supplier, { foreignKey: 'supplier_id' });
if(db.purchaseOrder && db.supplier) db.supplier.hasMany(db.purchaseOrder, { foreignKey: 'supplier_id' });
if(db.purchaseOrder && db.purchaseOrderItem) db.purchaseOrder.hasMany(db.purchaseOrderItem, { foreignKey: 'purchase_order_id' });
if(db.purchaseReceipt && db.purchaseOrder) db.purchaseReceipt.belongsTo(db.purchaseOrder, { foreignKey: 'purchase_order_id' });
if(db.purchaseReceipt && db.purchaseReceiptItem) db.purchaseReceipt.hasMany(db.purchaseReceiptItem, { foreignKey: 'receipt_id' });

if(db.purchaseInvoice && db.supplier) db.purchaseInvoice.belongsTo(db.supplier, { foreignKey: 'supplier_id' });
if(db.purchaseInvoice && db.supplier) db.supplier.hasMany(db.purchaseInvoice, { foreignKey: 'supplier_id' });
if(db.purchaseInvoice && db.purchaseReceipt) db.purchaseInvoice.belongsTo(db.purchaseReceipt, { foreignKey: 'receipt_id' });
if(db.purchaseReceipt && db.purchaseInvoice) db.purchaseReceipt.hasOne(db.purchaseInvoice, { foreignKey: 'receipt_id' });

if(db.formula && db.formulaIngredient) db.formula.hasMany(db.formulaIngredient, { foreignKey: 'formula_id' });
if(db.formula && db.formulaPackaging) db.formula.hasMany(db.formulaPackaging, { foreignKey: 'formula_id' });
if(db.formulaIngredient && db.rawMaterial) db.formulaIngredient.belongsTo(db.rawMaterial, { foreignKey: 'raw_material_id' });
if(db.formulaPackaging && db.packagingMaterial) db.formulaPackaging.belongsTo(db.packagingMaterial, { foreignKey: 'packaging_material_id' });

if(db.productionOrder && db.formula) db.productionOrder.belongsTo(db.formula, { foreignKey: 'formula_id' });
if(db.productionOrder && db.productionMaterial) db.productionOrder.hasMany(db.productionMaterial, { foreignKey: 'production_order_id' });
if(db.productionMaterial && db.productionOrder) db.productionMaterial.belongsTo(db.productionOrder, { foreignKey: 'production_order_id' });
if(db.productionOrder && db.finishedGood) db.productionOrder.belongsTo(db.finishedGood, { foreignKey: 'finished_good_id' });
if(db.finishedGood && db.productionOrder) db.finishedGood.hasMany(db.productionOrder, { foreignKey: 'finished_good_id' });
if(db.productionOrder && db.productionOutput) db.productionOrder.hasMany(db.productionOutput, { foreignKey: 'production_order_id' });
if(db.productionOutput && db.productionOrder) db.productionOutput.belongsTo(db.productionOrder, { foreignKey: 'production_order_id' });
if(db.productionOutput && db.finishedGood) db.productionOutput.belongsTo(db.finishedGood, { foreignKey: 'finished_good_id' });
if(db.finishedGood && db.productionOutput) db.finishedGood.hasMany(db.productionOutput, { foreignKey: 'finished_good_id' });

if(db.salesOrder && db.customer) db.salesOrder.belongsTo(db.customer, { foreignKey: 'customer_id' });
if(db.salesOrder && db.salesOrderItem) db.salesOrder.hasMany(db.salesOrderItem, { foreignKey: 'sales_order_id' });
if(db.salesOrderItem && db.finishedGood) db.salesOrderItem.belongsTo(db.finishedGood, { foreignKey: 'finished_good_id' });

if(db.salesInvoice && db.salesOrder) db.salesInvoice.belongsTo(db.salesOrder, { foreignKey: 'sales_order_id' });
if(db.salesInvoice && db.customer) db.salesInvoice.belongsTo(db.customer, { foreignKey: 'customer_id' });

if (db.retailSale && db.retailSaleItem) db.retailSale.hasMany(db.retailSaleItem, { foreignKey: 'retail_sale_id' });
if (db.retailSaleItem && db.retailSale) db.retailSaleItem.belongsTo(db.retailSale, { foreignKey: 'retail_sale_id' });
if (db.retailSaleItem && db.productionOrder) db.retailSaleItem.belongsTo(db.productionOrder, { foreignKey: 'production_order_id' });
if (db.productionOrder && db.retailSaleItem) db.productionOrder.hasOne(db.retailSaleItem, { foreignKey: 'production_order_id' });
if (db.productionOrder && db.retailSale) db.productionOrder.belongsTo(db.retailSale, { foreignKey: 'retail_sale_id' });
if (db.retailSale && db.productionOrder) db.retailSale.hasMany(db.productionOrder, { foreignKey: 'retail_sale_id' });
if (db.retailSale && db.customer) db.retailSale.belongsTo(db.customer, { foreignKey: 'customer_id' });
if (db.retailSale && db.account) db.retailSale.belongsTo(db.account, { foreignKey: 'payment_account_id', as: 'paymentAccount' });
if (db.retailSaleItem && db.finishedGood) db.retailSaleItem.belongsTo(db.finishedGood, { foreignKey: 'finished_good_id' });

if(db.journalEntry && db.journalEntryLine) db.journalEntry.hasMany(db.journalEntryLine, { foreignKey: 'journal_entry_id' });
if(db.journalEntry && db.journalEntryLine) db.journalEntryLine.belongsTo(db.journalEntry, { foreignKey: 'journal_entry_id' });
if(db.journalEntryLine && db.account) db.journalEntryLine.belongsTo(db.account, { foreignKey: 'account_id' });

if(db.payment && db.paymentAllocation) db.payment.hasMany(db.paymentAllocation, { foreignKey: 'payment_id' });
if(db.paymentMethod && db.account) db.paymentMethod.belongsTo(db.account, { foreignKey: 'account_id' });
if(db.paymentMethod && db.account) db.account.hasMany(db.paymentMethod, { foreignKey: 'account_id' });
if(db.payment && db.paymentMethod) db.payment.belongsTo(db.paymentMethod, { foreignKey: 'payment_method_id' });
if(db.expense && db.paymentMethod) db.expense.belongsTo(db.paymentMethod, { foreignKey: 'payment_method_id' });
if(db.retailSale && db.paymentMethod) db.retailSale.belongsTo(db.paymentMethod, { foreignKey: 'payment_method_id' });

if(db.account) {
    db.account.belongsTo(db.account, { as: 'Parent', foreignKey: 'parent_id' });
    db.account.hasMany(db.account, { as: 'Children', foreignKey: 'parent_id' });
}

if(db.product && db.formula) db.product.belongsTo(db.formula, { foreignKey: 'formula_id' });
if(db.formula && db.product) db.formula.hasMany(db.product, { foreignKey: 'formula_id' });
if(db.product && db.finishedGood) db.product.hasMany(db.finishedGood, { foreignKey: 'product_id' });
if(db.finishedGood && db.product) db.finishedGood.belongsTo(db.product, { foreignKey: 'product_id' });
if(db.finishedGood && db.formula) db.finishedGood.belongsTo(db.formula, { foreignKey: 'formula_id' });
if(db.finishedGood && db.variantPackaging) db.finishedGood.hasMany(db.variantPackaging, { foreignKey: 'finished_good_id' });
if(db.variantPackaging && db.finishedGood) db.variantPackaging.belongsTo(db.finishedGood, { foreignKey: 'finished_good_id' });
if(db.variantPackaging && db.packagingMaterial) db.variantPackaging.belongsTo(db.packagingMaterial, { foreignKey: 'packaging_material_id' });

if (db.inventoryDeficit && db.productionOrder) db.inventoryDeficit.belongsTo(db.productionOrder, { foreignKey: 'production_order_id' });
if (db.productionOrder && db.inventoryDeficit) db.productionOrder.hasMany(db.inventoryDeficit, { foreignKey: 'production_order_id' });

if(db.rawMaterial && db.stockBatch) {
    db.rawMaterial.hasMany(db.stockBatch, {
        foreignKey: 'material_id',
        constraints: false,
        scope: { material_type: 'raw' }
    });
}
if(db.rawMaterial && db.stockMovement) {
    db.rawMaterial.hasMany(db.stockMovement, {
        foreignKey: 'material_id',
        constraints: false,
        scope: { material_type: 'raw' }
    });
}
if(db.packagingMaterial && db.stockBatch) {
    db.packagingMaterial.hasMany(db.stockBatch, {
        foreignKey: 'material_id',
        constraints: false,
        scope: { material_type: 'packaging' }
    });
}
if(db.packagingMaterial && db.stockMovement) {
    db.packagingMaterial.hasMany(db.stockMovement, {
        foreignKey: 'material_id',
        constraints: false,
        scope: { material_type: 'packaging' }
    });
}


db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
