\pset pager off
SELECT 'tenants' AS metric, count(*)::text AS value FROM tenants;
SELECT id::text AS tenant_id, name FROM tenants ORDER BY created_at;
SELECT 'retail_sales' AS metric, count(*)::text AS value FROM retail_sales;
SELECT 'retail_sale_items' AS metric, count(*)::text AS value FROM retail_sale_items;
SELECT 'business_days' AS metric, count(*)::text AS value FROM business_days;
SELECT 'payments_in' AS metric, count(*)::text AS value FROM payments WHERE payment_type = 'incoming';
SELECT 'sale_journals' AS metric, count(*)::text AS value FROM journal_entries WHERE reference_type IN ('retail_sale', 'sale');
SELECT 'sale_movements' AS metric, count(*)::text AS value FROM stock_movements WHERE reference_type = 'retail_sale';
SELECT 'sale_production' AS metric, count(*)::text AS value FROM production_orders WHERE retail_sale_id IS NOT NULL;

SELECT tenant_id, count(*) AS sales, coalesce(sum(total_amount), 0) AS revenue
FROM retail_sales GROUP BY tenant_id ORDER BY tenant_id;

SELECT rs.id, rs.tenant_id, rs.sale_number, rs.sale_date, rs.total_amount,
       count(DISTINCT rsi.id) AS item_count,
       count(DISTINCT po.id) AS instant_production_count
FROM retail_sales rs
LEFT JOIN retail_sale_items rsi ON rsi.retail_sale_id = rs.id
LEFT JOIN production_orders po ON po.retail_sale_id = rs.id
GROUP BY rs.id ORDER BY rs.created_at;
