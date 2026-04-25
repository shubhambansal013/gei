BEGIN;
SELECT plan(1);

-- Load helpers
\ir helpers/auth.sql

-- Setup test data
SELECT tests.create_test_user('00000000-0000-0000-0000-000000000001', 'super@test.local', 'SUPER_ADMIN');

INSERT INTO sites (id, code, name) VALUES ('00000000-0000-0000-0000-000000000300', 'S3', 'Site 3');
INSERT INTO items (id, code, name, stock_unit) VALUES ('00000000-0000-0000-0000-000000000300', 'I3', 'Cement', 'MT');
INSERT INTO parties (id, name, type) VALUES ('00000000-0000-0000-0000-000000000300', 'Supplier 3', 'SUPPLIER');

-- 1. Golden path: Purchase 100 -> Issue 30 -> Balance 70
SELECT tests.authenticate_as('00000000-0000-0000-0000-000000000001');

-- Record Purchase
INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
VALUES ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000300', 100, 'MT', 1, 'MT');

-- Record Issue
INSERT INTO issues (site_id, item_id, qty, unit, party_id)
VALUES ('00000000-0000-0000-0000-000000000300', '00000000-0000-0000-0000-000000000300', 30, 'MT', '00000000-0000-0000-0000-000000000300');

-- Validate balance via a stock view or calculation
-- Assuming there might be a stock calculation function or view, but if not we can use a query
SELECT results_eq(
  $$
  SELECT (
    (SELECT COALESCE(SUM(stock_qty), 0) FROM purchases WHERE item_id = '00000000-0000-0000-0000-000000000300' AND is_deleted = false) -
    (SELECT COALESCE(SUM(qty), 0) FROM issues WHERE item_id = '00000000-0000-0000-0000-000000000300' AND is_deleted = false)
  )::numeric
  $$,
  ARRAY[70::numeric],
  'Golden path: 100 - 30 = 70'
);

SELECT * FROM finish();
ROLLBACK;
