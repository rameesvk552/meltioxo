\pset pager off
\set ON_ERROR_STOP on

SELECT t.id AS tenant_id, t.name, u.email,
       (SELECT count(*) FROM retail_sales rs WHERE rs.tenant_id = t.id) AS sales,
       (SELECT coalesce(sum(total_amount),0) FROM retail_sales rs WHERE rs.tenant_id = t.id) AS sale_revenue,
       (SELECT count(*) FROM payments p WHERE p.tenant_id = t.id AND p.payment_type = 'incoming') AS incoming_payments,
       (SELECT count(*) FROM business_days bd WHERE bd.tenant_id = t.id) AS business_days,
       (SELECT count(*) FROM production_orders po WHERE po.tenant_id = t.id AND po.retail_sale_id IS NOT NULL) AS sale_production
FROM tenants t JOIN users u ON u.tenant_id = t.id
WHERE t.id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND lower(trim(u.email)) = 'zaiqueperfume@gmail.com';

SELECT je.reference_type, count(*) AS entries, coalesce(sum(je.total_credit),0) AS credits
FROM journal_entries je
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND je.reference_type IN ('retail_sale_revenue','retail_sale_cogs','production_issue','production_completion')
GROUP BY je.reference_type ORDER BY je.reference_type;

SELECT coalesce(sum(jel.credit - jel.debit),0) AS posted_revenue_balance
FROM journal_entry_lines jel
JOIN journal_entries je ON je.id = jel.journal_entry_id AND je.status = 'posted'
JOIN accounts a ON a.id = jel.account_id AND a.type = 'revenue'
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

SELECT material_type, count(*) AS remaining_sale_movements
FROM stock_movements
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND reference_type = 'retail_sale'
GROUP BY material_type;

SELECT 'raw' AS stock_type, count(*) FILTER (WHERE current_stock < 0) AS negative_items, sum(current_stock) AS total_stock
FROM raw_materials WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
UNION ALL
SELECT 'packaging', count(*) FILTER (WHERE current_stock < 0), sum(current_stock)
FROM packaging_materials WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
UNION ALL
SELECT 'finished', count(*) FILTER (WHERE current_stock < 0), sum(current_stock)
FROM finished_goods WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

SELECT count(*) AS journal_count,
       min(entry_number) AS first_number,
       max(entry_number) AS last_number,
       count(DISTINCT entry_number) AS unique_numbers
FROM journal_entries
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

SELECT t.name, t.id, count(rs.id) AS sales, coalesce(sum(rs.total_amount),0) AS revenue
FROM tenants t JOIN retail_sales rs ON rs.tenant_id = t.id
GROUP BY t.id ORDER BY t.name, t.id;
