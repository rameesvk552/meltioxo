const money = value => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const quarterDates = (year, quarter) => {
  const firstMonth = (quarter - 1) * 3;
  const from = `${year}-${String(firstMonth + 1).padStart(2, '0')}-01`;
  const last = new Date(Date.UTC(year, firstMonth + 3, 0));
  const to = last.toISOString().slice(0, 10);
  return { from, to };
};

const estimateLevy = ({ sales, returns, rate }) => {
  const salesTurnover = money(sales.reduce((sum, row) => sum + Number(row.subtotal || 0) - Number(row.discount_amount || 0), 0));
  const returnedTurnover = money(returns.reduce((sum, row) => sum + Number(row.subtotal || 0) - Number(row.discount_amount || 0), 0));
  const netTurnover = money(Math.max(0, salesTurnover - returnedTurnover));
  const levy = money(netTurnover * Number(rate) / 100);
  const cgst = money(levy / 2);
  return { sales_turnover: salesTurnover, returned_turnover: returnedTurnover, net_turnover: netTurnover, rate: Number(rate), estimated_levy: levy, estimated_cgst: cgst, estimated_sgst: money(levy - cgst) };
};

module.exports = { quarterDates, estimateLevy };
