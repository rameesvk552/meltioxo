const { Op } = require('sequelize');
const db = require('../models');

const sequenceFromSaleNumbers = (saleNumbers, year) => {
  const matcher = new RegExp(`^RS-${year}-(\\d+)$`);
  return saleNumbers.reduce((highest, saleNumber) => {
    const match = matcher.exec(saleNumber);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0) + 1;
};

const nextRetailSaleNumber = async ({ tenantId, saleDate, transaction }) => {
  const year = new Date(saleDate).getFullYear();
  const prefix = `RS-${year}-`;

  // Serializes number allocation for this tenant until the surrounding sale commits.
  if (db.sequelize.getDialect() === 'postgres') {
    await db.sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
      replacements: { key: `${tenantId}:retail-sale-number:${year}` },
      transaction
    });
  }

  const sales = await db.retailSale.findAll({
    where: { tenant_id: tenantId, sale_number: { [Op.like]: `${prefix}%` } },
    attributes: ['sale_number'],
    transaction
  });
  const sequence = sequenceFromSaleNumbers(sales.map(sale => sale.sale_number), year);
  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

module.exports = { nextRetailSaleNumber, sequenceFromSaleNumbers };
