const money = value => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const incentiveBase = (sale, basis) => basis === 'TOTAL_INCL_TAX'
  ? Number(sale.total_amount || 0)
  : Number(sale.subtotal || 0) - Number(sale.discount_amount || 0);

const calculateIncentive = (sale, rate, basis, minimum = 0) => {
  const base = Math.max(0, incentiveBase(sale, basis));
  return money(Number(sale.total_amount || 0) < Number(minimum || 0) ? 0 : base * Number(rate || 0) / 100);
};

const effectiveIncentive = sale => {
  if (!sale.salesperson_id || !Number(sale.incentive_amount)) return 0;
  const returned = sale.incentive_basis === 'TOTAL_INCL_TAX'
    ? Number(sale.returned_amount || 0)
    : Number(sale.returned_revenue || 0);
  if (Number(sale.total_amount || 0) - Number(sale.returned_amount || 0) < Number(sale.incentive_min_sale_amount || 0)) return 0;
  return Math.min(Number(sale.incentive_amount), money(Math.max(0, incentiveBase(sale, sale.incentive_basis) - returned) * Number(sale.incentive_rate) / 100));
};

module.exports = { calculateIncentive, effectiveIncentive };
