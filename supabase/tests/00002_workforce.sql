BEGIN;
SELECT plan(4);

-- 1. Setup: Unique identifiers
DO $$
DECLARE
    u_code TEXT := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    s_id UUID;
    w_id UUID;
    p_id UUID;
BEGIN
    INSERT INTO sites (code, name) VALUES ('T-WRK-' || u_code, 'Worker Test Site ' || u_code) RETURNING id INTO s_id;

    -- 2. Test Minting Code
    INSERT INTO workers (full_name, current_site_id)
    VALUES ('John Doe ' || u_code, s_id) RETURNING id INTO w_id;

    -- 4. Test Site Assignment Overlap (EXCLUDE constraint)
    INSERT INTO worker_site_assignments (worker_id, site_id, effective_from, effective_to)
    VALUES (w_id, s_id, '2026-01-01', '2026-01-10');

    -- 5. Test Affiliation Overlap
    INSERT INTO parties (name, type, short_code)
    VALUES ('Contractor ' || u_code, 'CONTRACTOR', u_code) RETURNING id INTO p_id;

    INSERT INTO worker_affiliations (worker_id, employment_type, contractor_party_id, effective_from, effective_to)
    VALUES (w_id, 'CONTRACTOR_EMPLOYEE', p_id, '2026-01-01', '2026-01-10');
END $$;

SELECT matches(
    (SELECT code FROM workers WHERE full_name LIKE 'John Doe %' ORDER BY created_at DESC LIMIT 1),
    '^W-[0-9]{4,}$',
    'Worker code should be minted in the format W-XXXX'
);

SELECT throws_ok(
    'UPDATE workers SET code = ''W-9999'' WHERE full_name LIKE ''John Doe %''',
    'workers.code is immutable once minted',
    'Should throw an exception if trying to update the worker code'
);

SELECT throws_ok(
    'INSERT INTO worker_site_assignments (worker_id, site_id, effective_from, effective_to)
     SELECT id, current_site_id, ''2026-01-05'', ''2026-01-15''
     FROM workers WHERE full_name LIKE ''John Doe %'' ORDER BY created_at DESC LIMIT 1',
    'conflicting key value violates exclusion constraint "wsa_no_overlap"',
    'Should prevent overlapping site assignments'
);

SELECT throws_ok(
    'INSERT INTO worker_affiliations (worker_id, employment_type, contractor_party_id, effective_from, effective_to)
     SELECT worker_id, employment_type, contractor_party_id, ''2026-01-05'', ''2026-01-15''
     FROM worker_affiliations WHERE employment_type = ''CONTRACTOR_EMPLOYEE'' ORDER BY created_at DESC LIMIT 1',
    'conflicting key value violates exclusion constraint "wa_no_overlap"',
    'Should prevent overlapping affiliations'
);

SELECT * FROM finish();
ROLLBACK;
