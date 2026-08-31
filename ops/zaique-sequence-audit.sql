\pset pager off
SELECT entry_number, entry_date, reference_type, reference_id, created_at
FROM journal_entries
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
ORDER BY created_at;

SELECT payment_number, payment_type, payment_date, journal_entry_id, created_at
FROM payments
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
ORDER BY created_at;

SELECT order_number, retail_sale_id, status, created_at
FROM production_orders
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
ORDER BY created_at;
