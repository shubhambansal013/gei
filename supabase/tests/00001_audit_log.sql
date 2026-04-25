BEGIN;
SELECT plan(6);

-- 1. Setup: Ensure we have a site and an item
INSERT INTO sites (code, name) VALUES ('T-AUDIT', 'Audit Test Site');
INSERT INTO items (code, name, stock_unit) VALUES ('I-AUDIT', 'Audit Test Item', 'NOS');

-- 2. Test Purchase Audit
SET LOCAL "app.edit_reason" = 'Test purchase audit';
INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
SELECT
    (SELECT id FROM sites WHERE code = 'T-AUDIT'),
    (SELECT id FROM items WHERE code = 'I-AUDIT'),
    10, 'NOS', 1, 'NOS';

SELECT is(
    (SELECT edit_reason FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY created_at DESC LIMIT 1),
    'Test purchase audit',
    'Audit log should record the edit reason for purchases'
);

SELECT is(
    (SELECT operation FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY created_at DESC LIMIT 1),
    'INSERT',
    'Audit log should record the operation as INSERT for new purchases'
);

-- 3. Test Issue Audit
SET LOCAL "app.edit_reason" = 'Test issue audit';
INSERT INTO issues (site_id, item_id, qty, unit)
SELECT
    (SELECT id FROM sites WHERE code = 'T-AUDIT'),
    (SELECT id FROM items WHERE code = 'I-AUDIT'),
    5, 'NOS';

SELECT is(
    (SELECT edit_reason FROM inventory_edit_log WHERE table_name = 'issues' ORDER BY created_at DESC LIMIT 1),
    'Test issue audit',
    'Audit log should record the edit reason for issues'
);

-- 4. Test Update Audit
SET LOCAL "app.edit_reason" = 'Test update audit';
UPDATE purchases SET received_qty = 20 WHERE item_id = (SELECT id FROM items WHERE code = 'I-AUDIT');

SELECT is(
    (SELECT operation FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY created_at DESC LIMIT 1),
    'UPDATE',
    'Audit log should record the operation as UPDATE'
);

SELECT ok(
    (SELECT (new_data->>'received_qty')::numeric = 20 FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY created_at DESC LIMIT 1),
    'Audit log should record the new data in new_data column'
);

SELECT ok(
    (SELECT (old_data->>'received_qty')::numeric = 10 FROM inventory_edit_log WHERE table_name = 'purchases' ORDER BY created_at DESC LIMIT 1),
    'Audit log should record the old data in old_data column'
);

SELECT * FROM finish();
ROLLBACK;
