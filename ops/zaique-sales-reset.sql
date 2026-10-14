\set ON_ERROR_STOP on
\pset pager off
BEGIN ISOLATION LEVEL SERIALIZABLE;

-- Keep this brief reset isolated from concurrent writes while reports remain readable.
LOCK TABLE retail_sales, retail_sale_items, production_orders, production_materials,
  production_outputs, inventory_deficits, stock_movements, stock_batches,
  raw_materials, packaging_materials, finished_goods, payments, payment_allocations,
  journal_entries, journal_entry_lines, business_days IN SHARE ROW EXCLUSIVE MODE;

SELECT pg_advisory_xact_lock(hashtext('311c7e34-41f0-4059-b620-a331d14a6141:sales-test-reset'));

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

CREATE TEMP TABLE target_payments ON COMMIT DROP AS
SELECT * FROM payments WHERE journal_entry_id IN (SELECT id FROM target_journals);

CREATE TEMP TABLE target_days ON COMMIT DROP AS
SELECT * FROM business_days
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

CREATE TEMP TABLE target_production_batches ON COMMIT DROP AS
SELECT DISTINCT batch_id AS id
FROM stock_movements
WHERE reference_type = 'production_order'
  AND reference_id IN (SELECT id FROM target_production)
  AND material_type = 'finished' AND direction = 'in'
  AND batch_id IS NOT NULL;

CREATE TEMP TABLE affected_stock ON COMMIT DROP AS
SELECT material_type, material_id, sum(delta)::numeric AS expected_delta
FROM (
  SELECT material_type, material_id, quantity::numeric AS delta
  FROM stock_movements
  WHERE reference_type = 'retail_sale'
    AND reference_id IN (SELECT id FROM target_sales)
    AND direction = 'out'
  UNION ALL
  SELECT material_type, material_id,
         CASE WHEN direction = 'out' THEN quantity::numeric ELSE -quantity::numeric END AS delta
  FROM stock_movements
  WHERE reference_type = 'production_order'
    AND reference_id IN (SELECT id FROM target_production)
) movements
GROUP BY material_type, material_id;

CREATE TEMP TABLE stock_before ON COMMIT DROP AS
SELECT a.*,
       CASE a.material_type
         WHEN 'raw' THEN (SELECT current_stock FROM raw_materials WHERE id = a.material_id)
         WHEN 'packaging' THEN (SELECT current_stock FROM packaging_materials WHERE id = a.material_id)
         WHEN 'finished' THEN (SELECT current_stock FROM finished_goods WHERE id = a.material_id)
       END::numeric AS current_stock_before
FROM affected_stock a;

CREATE TEMP TABLE batch_deltas ON COMMIT DROP AS
SELECT batch_id AS id, sum(quantity)::numeric AS expected_delta
FROM stock_movements
WHERE batch_id IS NOT NULL AND direction = 'out'
  AND (
    (reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
    OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production))
  )
GROUP BY batch_id;

CREATE TEMP TABLE batch_before ON COMMIT DROP AS
SELECT sb.id, sb.remaining_qty::numeric AS remaining_before, bd.expected_delta
FROM stock_batches sb JOIN batch_deltas bd ON bd.id = sb.id;

DO $$
DECLARE
  exact_user_count integer;
  sale_count integer;
  sale_revenue numeric;
BEGIN
  SELECT count(*) INTO exact_user_count
  FROM users
  WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
    AND lower(replace(email, ' ', '')) = 'zaiqueperfume@gmail.com';
  IF exact_user_count <> 1 THEN RAISE EXCEPTION 'Target email/tenant guard failed'; END IF;

  SELECT count(*), coalesce(sum(total_amount),0) INTO sale_count, sale_revenue FROM target_sales;
  IF sale_count <> 7 OR sale_revenue <> 7500.00 THEN
    RAISE EXCEPTION 'Sales changed since audit: count %, revenue %', sale_count, sale_revenue;
  END IF;
  IF (SELECT count(*) FROM target_production) <> 6 THEN RAISE EXCEPTION 'Expected 6 sale-created production orders'; END IF;
  IF (SELECT count(*) FROM target_journals) <> 26 THEN RAISE EXCEPTION 'Expected 26 linked journals'; END IF;
  IF (SELECT count(*) FROM target_payments) <> 7 OR (SELECT coalesce(sum(amount),0) FROM target_payments) <> 7500.00 THEN
    RAISE EXCEPTION 'Expected 7 linked payments totaling 7500';
  END IF;
  IF (SELECT count(*) FROM target_days) <> 1 THEN RAISE EXCEPTION 'Expected one target business day'; END IF;
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE batch_id IN (SELECT id FROM target_production_batches)
      AND NOT ((reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
            OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production)))
  ) THEN RAISE EXCEPTION 'A sale-created batch has an external movement'; END IF;
  IF EXISTS (
    SELECT 1 FROM retail_sale_items
    WHERE production_order_id IN (SELECT id FROM target_production)
      AND retail_sale_id NOT IN (SELECT id FROM target_sales)
  ) THEN RAISE EXCEPTION 'A production order is linked to an external sale item'; END IF;
  IF EXISTS (
    SELECT 1 FROM inventory_deficits
    WHERE production_order_id IN (SELECT id FROM target_production) AND status <> 'open'
  ) THEN RAISE EXCEPTION 'A target inventory deficit was reconciled later'; END IF;
  IF EXISTS (
    SELECT 1 FROM payments p
    WHERE p.business_day_id IN (SELECT id FROM target_days)
      AND NOT EXISTS (SELECT 1 FROM target_payments tp WHERE tp.id = p.id)
  ) THEN RAISE EXCEPTION 'Target day contains a non-sale payment'; END IF;
  IF EXISTS (
    SELECT 1 FROM journal_entries je
    WHERE (je.reversal_of_id IN (SELECT id FROM target_journals)
       OR je.reversed_by_id IN (SELECT id FROM target_journals))
      AND je.id NOT IN (SELECT id FROM target_journals)
  ) THEN RAISE EXCEPTION 'Target journal has an external reversal link'; END IF;
END $$;

-- Restore every stock decrement using the immutable movement ledger.
UPDATE raw_materials rm
SET current_stock = rm.current_stock + a.expected_delta
FROM affected_stock a
WHERE a.material_type = 'raw' AND rm.id = a.material_id;

UPDATE packaging_materials pm
SET current_stock = pm.current_stock + a.expected_delta
FROM affected_stock a
WHERE a.material_type = 'packaging' AND pm.id = a.material_id;

UPDATE finished_goods fg
SET current_stock = fg.current_stock + a.expected_delta
FROM affected_stock a
WHERE a.material_type = 'finished' AND fg.id = a.material_id;

UPDATE stock_batches sb
SET remaining_qty = sb.remaining_qty + bd.expected_delta
FROM batch_deltas bd
WHERE sb.id = bd.id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM stock_before b
    LEFT JOIN raw_materials rm ON b.material_type = 'raw' AND rm.id = b.material_id
    LEFT JOIN packaging_materials pm ON b.material_type = 'packaging' AND pm.id = b.material_id
    LEFT JOIN finished_goods fg ON b.material_type = 'finished' AND fg.id = b.material_id
    WHERE abs(coalesce(rm.current_stock, pm.current_stock, fg.current_stock)::numeric
              - (b.current_stock_before + b.expected_delta)) > 0.0001
  ) THEN RAISE EXCEPTION 'Current-stock reversal validation failed'; END IF;
  IF EXISTS (
    SELECT 1 FROM batch_before b JOIN stock_batches sb ON sb.id = b.id
    WHERE abs(sb.remaining_qty::numeric - (b.remaining_before + b.expected_delta)) > 0.0001
  ) THEN RAISE EXCEPTION 'Batch-stock reversal validation failed'; END IF;
  IF EXISTS (
    SELECT 1 FROM target_production_batches tpb JOIN stock_batches sb ON sb.id = tpb.id
    WHERE abs(sb.remaining_qty::numeric - sb.quantity::numeric) > 0.0001
  ) THEN RAISE EXCEPTION 'Sale-created batch did not return to its full generated quantity'; END IF;
END $$;

DELETE FROM inventory_deficits WHERE production_order_id IN (SELECT id FROM target_production);
DELETE FROM retail_sale_items WHERE retail_sale_id IN (SELECT id FROM target_sales);

DELETE FROM stock_movements
WHERE (reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
   OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production));

DELETE FROM stock_batches WHERE id IN (SELECT id FROM target_production_batches);
DELETE FROM production_outputs WHERE production_order_id IN (SELECT id FROM target_production);
DELETE FROM production_materials WHERE production_order_id IN (SELECT id FROM target_production);
DELETE FROM production_orders WHERE id IN (SELECT id FROM target_production);

DELETE FROM payment_allocations WHERE payment_id IN (SELECT id FROM target_payments);
DELETE FROM payments WHERE id IN (SELECT id FROM target_payments);
DELETE FROM retail_sales WHERE id IN (SELECT id FROM target_sales);
DELETE FROM business_days WHERE id IN (SELECT id FROM target_days);

DELETE FROM journal_entry_lines WHERE journal_entry_id IN (SELECT id FROM target_journals);
DELETE FROM journal_entries WHERE id IN (SELECT id FROM target_journals);

-- Recreate the counterfactual journal sequence as if the test sales never existed.
UPDATE journal_entries
SET entry_number = 'RESET-' || id::text
WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;

WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS sequence_number
  FROM journal_entries
  WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
)
UPDATE journal_entries je
SET entry_number = 'JE-2026-' || lpad(r.sequence_number::text, 4, '0')
FROM ranked r WHERE je.id = r.id;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM retail_sales WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid) THEN RAISE EXCEPTION 'Sales remain'; END IF;
  IF EXISTS (SELECT 1 FROM production_orders WHERE id IN (SELECT id FROM target_production)) THEN RAISE EXCEPTION 'Sale production remains'; END IF;
  IF EXISTS (SELECT 1 FROM payments WHERE id IN (SELECT id FROM target_payments)) THEN RAISE EXCEPTION 'Sale payments remain'; END IF;
  IF EXISTS (SELECT 1 FROM journal_entries WHERE id IN (SELECT id FROM target_journals)) THEN RAISE EXCEPTION 'Sale journals remain'; END IF;
  IF EXISTS (SELECT 1 FROM business_days WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid) THEN RAISE EXCEPTION 'Business day remains'; END IF;
  IF EXISTS (
    SELECT 1 FROM stock_movements
    WHERE (reference_type = 'retail_sale' AND reference_id IN (SELECT id FROM target_sales))
       OR (reference_type = 'production_order' AND reference_id IN (SELECT id FROM target_production))
  ) THEN RAISE EXCEPTION 'Target stock movements remain'; END IF;
  IF EXISTS (SELECT 1 FROM stock_batches WHERE id IN (SELECT id FROM target_production_batches)) THEN RAISE EXCEPTION 'Sale-created batches remain'; END IF;
END $$;

SELECT material_type, count(*) AS affected_items, sum(expected_delta) AS net_stock_restored
FROM affected_stock GROUP BY material_type ORDER BY material_type;
SELECT count(*) AS remaining_sales, coalesce(sum(total_amount),0) AS remaining_revenue
FROM retail_sales WHERE tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid;
SELECT count(*) AS remaining_sale_journal_lines
FROM journal_entry_lines jel JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE je.tenant_id = '311c7e34-41f0-4059-b620-a331d14a6141'::uuid
  AND je.reference_type IN ('retail_sale_revenue','retail_sale_cogs');

COMMIT;
