\pset pager off

SELECT reference_type, count(*) AS rows, sum(total_debit) AS debit, sum(total_credit) AS credit
FROM journal_entries
GROUP BY reference_type ORDER BY reference_type;

SELECT rs.sale_number, rs.tenant_id, rs.journal_entry_id, rs.cogs_journal_id,
       count(DISTINCT p.id) AS linked_payments
FROM retail_sales rs
LEFT JOIN payments p ON p.journal_entry_id = rs.journal_entry_id
GROUP BY rs.id ORDER BY rs.created_at;

SELECT status, count(*) AS rows, sum(quantity) AS quantity, sum(remaining_qty) AS remaining
FROM inventory_deficits
WHERE production_order_id IN (SELECT id FROM production_orders WHERE retail_sale_id IS NOT NULL)
GROUP BY status;

SELECT sm.material_type, sm.movement_type, sm.direction, sm.reference_type,
       count(*) AS rows, sum(sm.quantity) AS quantity
FROM stock_movements sm
WHERE sm.reference_id IN (
  SELECT id FROM retail_sales
  UNION
  SELECT id FROM production_orders WHERE retail_sale_id IS NOT NULL
)
GROUP BY sm.material_type, sm.movement_type, sm.direction, sm.reference_type
ORDER BY 1,2,3,4;

SELECT conrelid::regclass AS child_table, a.attname AS child_column,
       confrelid::regclass AS parent_table, af.attname AS parent_column,
       confdeltype AS delete_action
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY(c.conkey)
JOIN pg_attribute af ON af.attrelid = c.confrelid AND af.attnum = ANY(c.confkey)
WHERE c.contype = 'f'
  AND (confrelid::regclass::text IN ('retail_sales','production_orders','journal_entries','payments','business_days','stock_batches','stock_movements')
       OR conrelid::regclass::text IN ('retail_sale_items','production_orders','production_materials','production_outputs','inventory_deficits','journal_entry_lines','payments','stock_movements'))
ORDER BY confrelid::regclass::text, conrelid::regclass::text;

SELECT bd.id, bd.tenant_id, bd.business_date, bd.status, bd.opening_cash,
       bd.total_sales, bd.sales_count,
       count(DISTINCT rs.id) AS actual_sales, coalesce(sum(DISTINCT rs.total_amount),0) AS actual_revenue,
       count(DISTINCT p.id) AS actual_payments
FROM business_days bd
LEFT JOIN retail_sales rs ON rs.business_day_id = bd.id
LEFT JOIN payments p ON p.business_day_id = bd.id
GROUP BY bd.id ORDER BY bd.business_date;

SELECT 'sales_orders' AS table_name, tenant_id, count(*) AS rows
FROM sales_orders GROUP BY tenant_id
UNION ALL
SELECT 'sales_invoices', tenant_id, count(*) FROM sales_invoices GROUP BY tenant_id
ORDER BY 1, 2;

SELECT bd.id, bd.tenant_id, bd.business_date, p.payment_type, count(*) AS rows, sum(p.amount) AS amount
FROM business_days bd
JOIN payments p ON p.business_day_id = bd.id
GROUP BY bd.id, p.payment_type ORDER BY bd.business_date, p.payment_type;

SELECT sm.id, sm.tenant_id, sm.reference_type, sm.reference_id, sm.material_type,
       sm.movement_type, sm.direction, sm.quantity, sm.notes
FROM stock_movements sm
WHERE sm.reference_type = 'data_correction'
  AND sm.reference_id IN (
    SELECT id FROM retail_sales
    UNION
    SELECT id FROM production_orders WHERE retail_sale_id IS NOT NULL
  );
