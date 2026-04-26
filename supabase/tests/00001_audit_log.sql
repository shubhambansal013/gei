BEGIN;
SELECT plan(3);

-- Setup: Unique alphanumeric identifiers
DO $$
DECLARE
    u_code TEXT := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    s_id UUID;
    i_id UUID;
BEGIN
    INSERT INTO sites (code, name) VALUES ('T-AUDIT-' || u_code, 'Audit Test Site ' || u_code) RETURNING id INTO s_id;
    INSERT INTO items (code, name, stock_unit) VALUES ('I-AUDIT-' || u_code, 'Audit Test Item ' || u_code, 'NOS') RETURNING id INTO i_id;

    INSERT INTO purchases (site_id, item_id, received_qty, received_unit, unit_conv_factor, stock_unit)
    VALUES (s_id, i_id, 10, 'NOS', 1, 'NOS');

    -- Test Update Audit
    EXECUTE 'SET LOCAL "app.edit_reason" = ''Test update audit''';
    UPDATE purchases SET received_qty = 20 WHERE item_id = i_id;
END $$;

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
