\set ON_ERROR_STOP on

BEGIN;

CREATE TEMP TABLE target_stock (
  product_code text PRIMARY KEY,
  target_name text NOT NULL,
  quantity numeric(15,4) NOT NULL CHECK (quantity >= 0)
) ON COMMIT DROP;

INSERT INTO target_stock (product_code, target_name, quantity) VALUES
  ('PROD-0026', 'Accentuate', 144),
  ('PROD-0027', 'American Blossom', 55),
  ('PROD-0006', 'Armani Passione', 450),
  ('PROD-0029', 'Azzaro', 41),
  ('PROD-0024', 'Azzaro Wanted', 300),
  ('PROD-0031', 'Baccarat 12', 465),
  ('PROD-0030', 'Baccarat Rouge Premium', 462),
  ('PROD-0032', 'Burberry Her', 25),
  ('PROD-0042', 'Black Opium AS', 270),
  ('PROD-0041', 'Bois Imperial', 295),
  ('PROD-0012', 'Cartier', 326),
  ('PROD-0033', 'Chanel Blue AS', 300),
  ('PROD-0040', 'Chelsea Attar', 184),
  ('PROD-0034', 'CK One AS', 16),
  ('PROD-0013', 'Cool Water Men', 318),
  ('PROD-0010', 'CY7 F', 335),
  ('PROD-0011', 'CY7 Red', 72),
  ('PROD-0036', 'Creed Aventus Premium', 240),
  ('PROD-0037', 'Calido', 146),
  ('PROD-0035', 'Dunhill Desire Red', 366),
  ('PROD-0038', 'Eternity Love HS', 160),
  ('PROD-0039', 'Gucci Flora Gardenia', 445),
  ('PROD-0043', 'Gucci Flora Era', 142),
  ('PROD-0044', 'God of Fire', 374),
  ('PROD-0045', 'Aissa Oryx', 265),
  ('PROD-0007', 'Hugo Boss', 470),
  ('PROD-0028', 'Jaguar Black', 174),
  ('PROD-0047', 'J''adore Dior', 206),
  ('PROD-0046', 'Jordan Attar', 44),
  ('PROD-0022', 'Khamrah', 400),
  ('PROD-0015', 'Lavender Oud', 90),
  ('PROD-0008', 'Lovely', 435),
  ('PROD-0001', 'Lara M', 60),
  ('PROD-0052', 'La Vie Est Belle', 210),
  ('PROD-0009', 'Marj Magribi', 87),
  ('PROD-0025', 'Mariyam Dahabi', 265),
  ('PROD-0048', 'Milkhan', 293),
  ('PROD-0020', 'Mixed Fruits', 130),
  ('PROD-0049', 'Most Wanted', 325),
  ('PROD-0017', 'Musk Pomegranate', 436),
  ('PROD-0051', 'Musk Rizali', 339),
  ('PROD-0016', 'Musk Peach', 357),
  ('PROD-0050', 'Musk Layali', 235),
  ('PROD-0053', 'Neroli', 145),
  ('PROD-0021', 'One Million', 467),
  ('PROD-0055', 'Oud and Roses', 0),
  ('PROD-0056', 'Oud for Greatness', 232),
  ('PROD-0057', 'Pina Bliss', 65),
  ('PROD-0014', 'Plum Noir', 0),
  ('PROD-0002', 'Polo Blue', 16),
  ('PROD-0058', 'Property', 377),
  ('PROD-0059', 'Pink Chiffon', 276),
  ('PROD-0060', 'Royal Mirage', 180),
  ('PROD-0023', 'Sabaya', 130),
  ('PROD-0061', 'Sandal SP', 80),
  ('PROD-0066', 'Skin Nature', 9),
  ('PROD-0067', 'Stronger With You', 97),
  ('PROD-0065', 'Synthetic Jungle', 107),
  ('PROD-0019', 'Sweet Berry', 225),
  ('PROD-0064', 'Tobacco Vanille Premium', 285),
  ('PROD-0063', 'Topper One', 243),
  ('PROD-0018', 'Ultra Male', 390),
  ('PROD-0062', 'Velvet Musk AS', 217),
  ('PROD-0005', 'Burberry For Her', 593),
  ('PROD-0070', 'La Bomba', 180),
  ('PROD-0003', 'Bahana', 140);

DO $$
DECLARE
  tenant_count integer;
  matched_count integer;
  variant_count integer;
  nonzero_count integer;
BEGIN
  SELECT count(*) INTO tenant_count FROM tenants WHERE name = 'Arabelegance';
  IF tenant_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one Arabelegance tenant, found %', tenant_count;
  END IF;

  SELECT count(*) INTO matched_count
  FROM products p
  JOIN tenants t ON t.id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance';
  IF matched_count <> 66 THEN
    RAISE EXCEPTION 'Expected 66 matched products, found %', matched_count;
  END IF;

  SELECT count(*) INTO variant_count
  FROM finished_goods fg
  JOIN products p ON p.id = fg.product_id AND p.tenant_id = fg.tenant_id
  JOIN tenants t ON t.id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance';
  IF variant_count <> 66 THEN
    RAISE EXCEPTION 'Expected 66 matched finished variants, found %', variant_count;
  END IF;

  SELECT count(*) INTO nonzero_count
  FROM finished_goods fg
  JOIN products p ON p.id = fg.product_id AND p.tenant_id = fg.tenant_id
  JOIN tenants t ON t.id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance' AND abs(fg.current_stock) > 0.00005;
  IF nonzero_count <> 0 THEN
    RAISE EXCEPTION 'Expected all matched finished stocks to be zero; % are nonzero', nonzero_count;
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
       coalesce(fg.cost_price, 0),
       'OPEN-' || fg.sku || '-20260909'
FROM finished_goods fg
JOIN products p ON p.id = fg.product_id AND p.tenant_id = fg.tenant_id
JOIN tenants t ON t.id = p.tenant_id
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
  total_quantity numeric;
  batch_count integer;
  movement_count integer;
BEGIN
  SELECT count(*), coalesce(sum(fg.current_stock), 0)
  INTO wrong_count, total_quantity
  FROM finished_goods fg
  JOIN products p ON p.id = fg.product_id AND p.tenant_id = fg.tenant_id
  JOIN tenants t ON t.id = p.tenant_id
  JOIN target_stock s ON s.product_code = p.code
  WHERE t.name = 'Arabelegance' AND fg.current_stock <> s.quantity;

  IF wrong_count <> 0 THEN
    RAISE EXCEPTION '% finished-product balances do not match the supplied quantities', wrong_count;
  END IF;

  SELECT count(*) INTO batch_count FROM prepared_batches;
  IF batch_count <> 64 THEN
    RAISE EXCEPTION 'Expected 64 positive-quantity batches, found %', batch_count;
  END IF;

  SELECT count(*) INTO movement_count
  FROM stock_movements sm
  JOIN prepared_batches pb ON pb.id = sm.batch_id;
  IF movement_count <> 64 THEN
    RAISE EXCEPTION 'Expected 64 stock movements, found %', movement_count;
  END IF;
END $$;

COMMIT;

SELECT count(*) AS matched_products,
       count(*) FILTER (WHERE fg.current_stock > 0) AS positive_products,
       sum(fg.current_stock) AS total_finished_stock
FROM finished_goods fg
JOIN products p ON p.id = fg.product_id AND p.tenant_id = fg.tenant_id
JOIN tenants t ON t.id = p.tenant_id
WHERE t.name = 'Arabelegance'
  AND p.code IN (
    'PROD-0026','PROD-0027','PROD-0006','PROD-0029','PROD-0024','PROD-0031','PROD-0030','PROD-0032',
    'PROD-0042','PROD-0041','PROD-0012','PROD-0033','PROD-0040','PROD-0034','PROD-0013','PROD-0010',
    'PROD-0011','PROD-0036','PROD-0037','PROD-0035','PROD-0038','PROD-0039','PROD-0043','PROD-0044',
    'PROD-0045','PROD-0007','PROD-0028','PROD-0047','PROD-0046','PROD-0022','PROD-0015','PROD-0008',
    'PROD-0001','PROD-0052','PROD-0009','PROD-0025','PROD-0048','PROD-0020','PROD-0049','PROD-0017',
    'PROD-0051','PROD-0016','PROD-0050','PROD-0053','PROD-0021','PROD-0055','PROD-0056','PROD-0057',
    'PROD-0014','PROD-0002','PROD-0058','PROD-0059','PROD-0060','PROD-0023','PROD-0061','PROD-0066',
    'PROD-0067','PROD-0065','PROD-0019','PROD-0064','PROD-0063','PROD-0018','PROD-0062','PROD-0005',
    'PROD-0070','PROD-0003'
  );
