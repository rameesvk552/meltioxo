\pset pager off
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SELECT t.name, t.id,
 (SELECT count(*) FROM retail_sales s WHERE s.tenant_id=t.id) AS sales,
 (SELECT count(*) FROM production_orders p WHERE p.tenant_id=t.id) AS production_orders,
 (SELECT count(*) FROM journal_entries j WHERE j.tenant_id=t.id AND status='posted') AS posted_journals
FROM tenants t ORDER BY name;
WITH balances AS (
 SELECT a.tenant_id, a.id, a.code, a.type, a.balance,
 coalesce(sum(CASE WHEN a.type IN ('asset','expense') THEN l.debit-l.credit ELSE l.credit-l.debit END) FILTER (WHERE j.status='posted'),0) AS actual
 FROM accounts a LEFT JOIN journal_entry_lines l ON l.account_id=a.id
 LEFT JOIN journal_entries j ON j.id=l.journal_entry_id AND j.tenant_id=a.tenant_id
 GROUP BY a.id
)
SELECT t.name, count(*) FILTER (WHERE abs(b.balance-b.actual)>.005) AS stale_balances,
 round(sum(CASE WHEN b.type='asset' THEN actual ELSE 0 END),2) AS assets,
 round(sum(CASE WHEN b.type='liability' THEN actual ELSE 0 END),2) AS liabilities,
 round(sum(CASE WHEN b.type='equity' THEN actual ELSE 0 END),2) AS posted_equity,
 round(sum(CASE WHEN b.type='revenue' THEN actual WHEN b.type='expense' THEN -actual ELSE 0 END),2) AS unclosed_profit
FROM balances b JOIN tenants t ON t.id=b.tenant_id GROUP BY t.id ORDER BY t.name;
SELECT t.name, j.reference_type, count(*) AS journals, min(j.entry_date), max(j.entry_date), sum(j.total_debit) AS posted_value
FROM journal_entries j JOIN tenants t ON t.id=j.tenant_id WHERE j.status='posted'
GROUP BY t.id,j.reference_type ORDER BY t.name,j.reference_type;
SELECT t.name, count(*) AS unbalanced_journals FROM journal_entries j JOIN tenants t ON t.id=j.tenant_id
JOIN journal_entry_lines l ON l.journal_entry_id=j.id WHERE j.status='posted'
GROUP BY t.id,j.id HAVING sum(l.debit)<>sum(l.credit);
SELECT t.name, p.status, count(*) AS orders,
 coalesce(sum((SELECT sum(m.consumed_cost) FROM production_materials m WHERE m.production_order_id=p.id)),0) AS consumed_material_cost
FROM production_orders p JOIN tenants t ON t.id=p.tenant_id GROUP BY t.id,p.status ORDER BY t.name,p.status;
SELECT t.name,
 (SELECT coalesce(sum(s.subtotal-s.discount_amount),0) FROM retail_sales s WHERE s.tenant_id=t.id) AS sales_income,
 (SELECT coalesce(sum(s.cogs_amount),0) FROM retail_sales s WHERE s.tenant_id=t.id) AS sales_cogs,
 (SELECT coalesce(sum(CASE WHEN a.type='revenue' THEN l.credit-l.debit WHEN a.code='5202' THEN l.credit-l.debit ELSE 0 END),0)
  FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
  WHERE j.tenant_id=t.id AND j.status='posted' AND j.reference_type IN ('retail_sale_revenue','sales_return')) AS posted_sales_income,
 (SELECT coalesce(sum(l.debit-l.credit),0) FROM journal_entry_lines l JOIN journal_entries j ON j.id=l.journal_entry_id JOIN accounts a ON a.id=l.account_id
  WHERE j.tenant_id=t.id AND j.status='posted' AND a.code='5102') AS posted_cogs
FROM tenants t ORDER BY t.name;
ROLLBACK;
