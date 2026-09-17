\pset pager off
\set ON_ERROR_STOP on

SELECT id, name, created_at
FROM tenants
WHERE lower(name) LIKE '%zaique%';

SELECT u.name AS user_name, u.email, u.role, u.tenant_id, t.name AS tenant_name
FROM users u
JOIN tenants t ON t.id = u.tenant_id
WHERE lower(t.name) LIKE '%zaique%'
ORDER BY u.created_at;

SELECT t.id AS tenant_id, t.name,
       count(rs.id) AS sales,
       coalesce(sum(rs.subtotal), 0)::numeric(15,2) AS gross_sales,
       coalesce(sum(rs.discount_amount), 0)::numeric(15,2) AS discounts,
       coalesce(sum(rs.total_amount), 0)::numeric(15,2) AS net_invoice_total
FROM tenants t
LEFT JOIN retail_sales rs ON rs.tenant_id = t.id
WHERE lower(t.name) LIKE '%zaique%'
GROUP BY t.id
ORDER BY t.created_at;

SELECT 'retail_sales_ytd' AS metric,
       count(*) AS rows,
       sum(subtotal)::numeric(15,2) AS subtotal,
       sum(discount_amount)::numeric(15,2) AS discounts,
       sum(tax_amount)::numeric(15,2) AS tax,
       sum(total_amount)::numeric(15,2) AS invoice_total,
       (sum(subtotal) - sum(discount_amount))::numeric(15,2) AS sales_revenue
FROM retail_sales
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND sale_date BETWEEN DATE '2026-01-01' AND DATE '2026-08-25';

SELECT 'sales_returns_ytd' AS metric,
       count(*) AS rows,
       coalesce(sum(subtotal), 0)::numeric(15,2) AS subtotal,
       coalesce(sum(discount_amount), 0)::numeric(15,2) AS discounts,
       coalesce(sum(tax_amount), 0)::numeric(15,2) AS tax,
       coalesce(sum(total_amount), 0)::numeric(15,2) AS refund_total,
       (coalesce(sum(subtotal), 0) - coalesce(sum(discount_amount), 0))::numeric(15,2) AS returned_revenue
FROM sales_returns
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND return_date BETWEEN DATE '2026-01-01' AND DATE '2026-08-25';

SELECT sale_date,
       count(*) AS bills,
       sum(subtotal - discount_amount)::numeric(15,2) AS revenue_ex_tax,
       sum(tax_amount)::numeric(15,2) AS tax,
       sum(total_amount)::numeric(15,2) AS collected_inc_tax
FROM retail_sales
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND sale_date BETWEEN DATE '2026-01-01' AND DATE '2026-08-25'
GROUP BY sale_date
ORDER BY sale_date;

SELECT a.code, a.name, a.type,
       sum(jel.debit)::numeric(15,2) AS debit,
       sum(jel.credit)::numeric(15,2) AS credit,
       CASE WHEN a.type = 'revenue'
            THEN sum(jel.credit - jel.debit)
            ELSE sum(jel.debit - jel.credit)
       END::numeric(15,2) AS report_amount
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND je.status = 'posted'
  AND je.entry_date BETWEEN DATE '2026-01-01' AND DATE '2026-08-25'
  AND a.type IN ('revenue', 'expense')
GROUP BY a.id, a.code, a.name, a.type
ORDER BY a.type DESC, a.code;

SELECT je.reference_type,
       count(DISTINCT je.id) AS journals,
       sum(CASE WHEN a.type = 'revenue' THEN jel.credit - jel.debit ELSE 0 END)::numeric(15,2) AS revenue,
       sum(CASE WHEN a.type = 'expense' THEN jel.debit - jel.credit ELSE 0 END)::numeric(15,2) AS expense
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id
JOIN accounts a ON a.id = jel.account_id
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND je.status = 'posted'
  AND je.entry_date BETWEEN DATE '2026-01-01' AND DATE '2026-08-25'
  AND a.type IN ('revenue', 'expense')
GROUP BY je.reference_type
ORDER BY je.reference_type;

SELECT rs.sale_number, rs.sale_date, rs.created_at,
       rs.subtotal, rs.discount_amount, rs.total_amount,
       coalesce(sum(CASE WHEN a.code = '4102' THEN jel.credit - jel.debit ELSE 0 END), 0)::numeric(15,2) AS sales_account,
       coalesce(sum(CASE WHEN a.code = '5202' THEN jel.debit - jel.credit ELSE 0 END), 0)::numeric(15,2) AS discount_account
FROM retail_sales rs
LEFT JOIN journal_entries je ON je.id = rs.journal_entry_id
LEFT JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
LEFT JOIN accounts a ON a.id = jel.account_id
WHERE rs.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
  AND rs.discount_amount <> 0
GROUP BY rs.id
ORDER BY rs.created_at;

SELECT bd.business_date, bd.status, bd.sales_count, bd.total_sales AS stored_total_sales,
       count(DISTINCT rs.id) AS actual_bills,
       coalesce(sum(DISTINCT rs.total_amount), 0)::numeric(15,2) AS gross_invoice_total
FROM business_days bd
LEFT JOIN retail_sales rs ON rs.business_day_id = bd.id
WHERE bd.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'
GROUP BY bd.id
ORDER BY bd.business_date;
