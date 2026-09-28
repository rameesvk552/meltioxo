const { AppError } = require('../middleware/errorHandler');

const cents = value => Math.round(Number(value) * 100);

// Allocate an invoice discount over taxable lines in cents, so mixed GST rates
// retain the correct tax base and the allocated amount always matches the invoice.
const calculatePurchaseTotals = (items, discountValue = 0) => {
  const bases = items.map(row => cents(Number(row.quantity) * Number(row.unit_price)));
  const subtotalCents = bases.reduce((sum, value) => sum + value, 0);
  const discountCents = cents(discountValue);
  if (!Number.isFinite(discountCents) || discountCents < 0 || discountCents > subtotalCents) {
    throw new AppError('Discount must be between zero and the purchase subtotal', 400);
  }
  let remaining = discountCents;
  let taxCents = 0;
  items.forEach((row, index) => {
    const share = index === items.length - 1 ? remaining : subtotalCents
      ? Math.round(discountCents * bases[index] / subtotalCents) : 0;
    remaining -= share;
    taxCents += Math.round((bases[index] - share) * Number(row.tax_rate || 0) / 100);
  });
  return {
    subtotal: subtotalCents / 100,
    discount_amount: discountCents / 100,
    tax_amount: taxCents / 100,
    total_amount: (subtotalCents - discountCents + taxCents) / 100
  };
};

module.exports = { calculatePurchaseTotals };
