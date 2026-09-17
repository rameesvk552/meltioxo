\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE target_stock (
  product_code text PRIMARY KEY,
  quantity numeric(15,4) NOT NULL CHECK (quantity >= 0)
) ON COMMIT DROP;

INSERT INTO target_stock (product_code, quantity) VALUES
  ('PROD-0068', 30),
  ('PROD-0054', 155),
  ('PROD-0004', 250),
  ('PROD-0069', 0);

DO $$
DECLARE
  matched_count integer;
  nonzero_count integer;
BEGIN
  SELECT count(*) INTO matched_count
  FROM products p
  JOIN tenants t ON t.id = p.tenant_id
  JOIN finished_goods fg ON fg.product_id = p.id AND fg.tenant_id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance';
  IF matched_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 matched finished products, found %', matched_count;
  END IF;

  SELECT count(*) INTO nonzero_count
  FROM products p
  JOIN tenants t ON t.id = p.tenant_id
  JOIN finished_goods fg ON fg.product_id = p.id AND fg.tenant_id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance' AND abs(fg.current_stock) > 0.00005;
  IF nonzero_count <> 0 THEN
    RAISE EXCEPTION 'Expected all 4 remaining finished stocks to be zero; % are nonzero', nonzero_count;
  END IF;
END $$;

CREATE TEMP TABLE prepared_batches (
  id uuid PRIMARY KEY,
  tenant_id uuid NOT NULL,
  finished_good_id uuid NOT NULL,
  quantity numeric(15,4) NOT NULL,
  unit_cost numeric(15,4) NOT NULL,
  batch_number text NOT NULL
) ON COMMIT DROP;

INSERT INTO prepared_batches (id, tenant_id, finished_good_id, quantity, unit_cost, batch_number)
SELECT gen_random_uuid(), fg.tenant_id, fg.id, s.quantity,
       coalesce(fg.cost_price, 0), 'OPEN-' || fg.sku || '-20260909-B'
FROM products p
JOIN tenants t ON t.id = p.tenant_id
JOIN finished_goods fg ON fg.product_id = p.id AND fg.tenant_id = p.tenant_id
JOIN target_stock s ON s.product_code = p.code
WHERE t.name = 'Arabelegance' AND s.quantity > 0;

INSERT INTO stock_batches (
  id, tenant_id, material_type, material_id, batch_number,
  quantity, remaining_qty, cost_per_unit, received_date, created_at, updated_at
)
SELECT id, tenant_id, 'finished', finished_good_id, batch_number,
       quantity, quantity, unit_cost, CURRENT_DATE, now(), now()
FROM prepared_batches;

INSERT INTO stock_movements (
  id, tenant_id, material_type, material_id, movement_type, direction,
  quantity, unit_cost, total_cost, batch_id, reference_type, reference_id,
  notes, created_at, updated_at
)
SELECT gen_random_uuid(), tenant_id, 'finished', finished_good_id, 'adjustment', 'in',
       quantity, unit_cost, quantity * unit_cost, id,
       'finished_stock_adjustment', finished_good_id,
       'Opening finished-product stock from physical count supplied 2026-09-09',
       now(), now()
FROM prepared_batches;

UPDATE finished_goods fg
SET current_stock = s.quantity, updated_at = now()
FROM products p, tenants t, target_stock s
WHERE p.id = fg.product_id
  AND p.tenant_id = fg.tenant_id
  AND t.id = p.tenant_id
  AND t.name = 'Arabelegance'
  AND s.product_code = p.code;

DO $$
DECLARE
  wrong_count integer;
BEGIN
  SELECT count(*) INTO wrong_count
  FROM products p
  JOIN tenants t ON t.id = p.tenant_id
  JOIN finished_goods fg ON fg.product_id = p.id AND fg.tenant_id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance' AND fg.current_stock <> s.quantity;
  IF wrong_count <> 0 THEN
    RAISE EXCEPTION '% finished-product balances do not match the supplied quantities', wrong_count;
  END IF;

  IF (SELECT count(*) FROM prepared_batches) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 positive-quantity batches';
  END IF;

  IF (SELECT count(*) FROM stock_movements sm JOIN prepared_batches pb ON pb.id = sm.batch_id) <> 3 THEN
    RAISE EXCEPTION 'Expected 3 matching stock movements';
  END IF;
END $$;

COMMIT;

SELECT count(*) AS products,
       count(*) FILTER (WHERE fg.current_stock > 0) AS products_with_stock,
       sum(fg.current_stock) AS total_finished_stock
FROM finished_goods fg
JOIN tenants t ON t.id = fg.tenant_id
WHERE t.name = 'Arabelegance';
