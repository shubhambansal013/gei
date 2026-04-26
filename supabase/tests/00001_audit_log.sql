BEGIN;
SELECT plan(3);

-- 1. Setup: Ensure we have a site and an item
INSERT INTO sites (code, name) VALUES ('T-AUDIT', 'Audit Test Site');
INSERT INTO items (code, name, stock_unit) VALUES ('I-AUDIT', 'Audit Test Item', 'NOS');

-- 2. Setup: A purchase to update
INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
SELECT
    (SELECT id FROM sites WHERE code = 'T-AUDIT'),
    (SELECT id FROM items WHERE code = 'I-AUDIT'),
    10, 'NOS', 1, 'NOS';

-- 3. Test Update Audit
SET LOCAL "app.edit_reason" = 'Test update audit';
UPDATE purchases SET received_qty = 20 WHERE item_id = (SELECT id FROM items WHERE code = 'I-AUDIT');

SELECT is(
    (SELECT reason FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY changed_at DESC LIMIT 1),
    'Test update audit',
    'Audit log should record the reason for updates'
);

SELECT ok(
    (SELECT (after_data->>'received_qty')::numeric = 20 FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY changed_at DESC LIMIT 1),
    'Audit log should record the new data in after_data column'
);

SELECT ok(
    (SELECT (before_data->>'received_qty')::numeric = 10 FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY changed_at DESC LIMIT 1),
    'Audit log should record the old data in before_data column'
);

SELECT * FROM finish();
ROLLBACK;
