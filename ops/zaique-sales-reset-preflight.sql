\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;

CREATE TEMP TABLE target_sales ON COMMIT DROP AS
SELECT * FROM retail_sales
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

CREATE TEMP TABLE target_production ON COMMIT DROP AS
SELECT * FROM production_orders
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND retail_sale_id IN (SELECT id FROM target_sales);

CREATE TEMP TABLE target_journals ON COMMIT DROP AS
SELECT DISTINCT je.id
FROM journal_entries je
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND (
    (je.reference_type IN ('retail_sale_revenue', 'retail_sale_cogs') AND je.reference_id IN (SELECT id FROM target_sales))
    OR
    (je.reference_type IN ('production_issue', 'production_completion') AND je.reference_id IN (SELECT id FROM target_production))
    OR je.id IN (SELECT journal_entry_id FROM target_sales WHERE journal_entry_id IS NOT NULL)
    OR je.id IN (SELECT cogs_journal_id FROM target_sales WHERE cogs_journal_id IS NOT NULL)
    OR je.id IN (SELECT journal_entry_id FROM target_production WHERE journal_entry_id IS NOT NULL)
  );

CREATE TEMP TABLE target_production_batches ON COMMIT DROP AS
SELECT DISTINCT batch_id AS id
FROM stock_movements
WHERE reference_type = 'production_order'
  AND reference_id IN (SELECT id FROM target_production)
  AND material_type = 'finished' AND direction = 'in'
  AND batch_id IS NOT NULL;

SELECT 'sales' AS metric, count(*) AS rows, coalesce(sum(total_amount),0)::numeric AS amount FROM target_sales
UNION ALL SELECT 'sale_items', count(*), coalesce(sum(quantity),0) FROM retail_sale_items WHERE retail_sale_id IN (SELECT id FROM target_sales)
UNION ALL SELECT 'production_orders', count(*), coalesce(sum(actual_qty),0) FROM target_production
UNION ALL SELECT 'payments', count(*), coalesce(sum(amount),0) FROM payments WHERE journal_entry_id IN (SELECT id FROM target_journals)
UNION ALL SELECT 'journals', count(*), coalesce(sum(total_debit),0) FROM journal_entries WHERE id IN (SELECT id FROM target_journals)
UNION ALL SELECT 'business_days', count(*), coalesce(sum(opening_cash),0) FROM business_days WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
ORDER BY metric;

SELECT reference_type, count(*) AS rows, sum(total_debit) AS debit
FROM journal_entries WHERE id IN (SELECT id FROM target_journals)
GROUP BY reference_type ORDER BY reference_type;

SELECT material_type, movement_type, direction, reference_type,
       count(*) AS rows, sum(quantity) AS quantity
FROM stock_movements
WHERE (reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
   OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production))
GROUP BY material_type, movement_type, direction, reference_type
ORDER BY 1,2,3,4;

SELECT status, count(*) AS rows, sum(quantity) AS quantity, sum(remaining_qty) AS remaining
FROM inventory_deficits
WHERE production_order_id IN (SELECT id FROM target_production)
GROUP BY status;

SELECT 'external_batch_movements' AS safety_check, count(*) AS violations
FROM stock_movements
WHERE batch_id IN (SELECT id FROM target_production_batches)
  AND NOT (
    (reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
    OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production))
  )
UNION ALL
SELECT 'external_production_item_links', count(*)
FROM retail_sale_items
WHERE production_order_id IN (SELECT id FROM target_production)
  AND retail_sale_id NOT IN (SELECT id FROM target_sales)
UNION ALL
SELECT 'external_day_sales', count(*)
FROM retail_sales
WHERE business_day_id IN (SELECT id FROM business_days WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid)
  AND tenant_id <> '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
UNION ALL
SELECT 'external_day_payments', count(*)
FROM payments
WHERE business_day_id IN (SELECT id FROM business_days WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid)
  AND journal_entry_id NOT IN (SELECT id FROM target_journals)
UNION ALL
SELECT 'reconciled_deficits', count(*)
FROM inventory_deficits
WHERE production_order_id IN (SELECT id FROM target_production)
  AND status <> 'open';

SELECT sb.id, sb.batch_number, sb.quantity, sb.remaining_qty,
       coalesce(sum(CASE WHEN sm.reference_type = 'retail_sale' THEN sm.quantity ELSE 0 END),0) AS sold_qty
FROM stock_batches sb
JOIN target_production_batches tpb ON tpb.id = sb.id
LEFT JOIN stock_movements sm ON sm.batch_id = sb.id
GROUP BY sb.id ORDER BY sb.created_at;

ROLLBACK;
