BEGIN;
SELECT plan(4);

-- 1. Setup: Ensure we have a site
INSERT INTO sites (code, name) VALUES ('T-WORKER', 'Worker Test Site');

-- 2. Test Minting Code
INSERT INTO workers (full_name, current_site_id)
VALUES ('John Doe', (SELECT id FROM sites WHERE code = 'T-WORKER'));

SELECT matches(
    (SELECT code FROM workers WHERE full_name = 'John Doe'),
    '^W-[0-9]{4,}$',
    'Worker code should be minted in the format W-XXXX'
);

-- 3. Test Code Immutability
SELECT throws_ok(
    'UPDATE workers SET code = ''W-9999'' WHERE full_name = ''John Doe''',
    'workers.code is immutable once minted',
    'Should throw an exception if trying to update the worker code'
);

-- 4. Test Site Assignment Overlap (EXCLUDE constraint)
INSERT INTO worker_site_assignments (worker_id, site_id, effective_from, effective_to)
SELECT id, current_site_id, '2026-01-01', '2026-01-10'
FROM workers WHERE full_name = 'John Doe';

SELECT throws_ok(
    'INSERT INTO worker_site_assignments (worker_id, site_id, effective_from, effective_to)
     SELECT id, current_site_id, ''2026-01-05'', ''2026-01-15''
     FROM workers WHERE full_name = ''John Doe''',
    'conflicting key value violates exclusion constraint "wsa_no_overlap"',
    'Should prevent overlapping site assignments'
);

-- 5. Test Affiliation Overlap
-- First need a contractor party
INSERT INTO parties (name, type) VALUES ('Contractor Alpha', 'CONTRACTOR');

INSERT INTO worker_affiliations (worker_id, employment_type, contractor_party_id, effective_from, effective_to)
SELECT id, 'CONTRACTOR_EMPLOYEE', (SELECT id FROM parties WHERE name = 'Contractor Alpha'), '2026-01-01', '2026-01-10'
FROM workers WHERE full_name = 'John Doe';

SELECT throws_ok(
    'INSERT INTO worker_affiliations (worker_id, employment_type, contractor_party_id, effective_from, effective_to)
     SELECT id, ''CONTRACTOR_EMPLOYEE'', (SELECT id FROM parties WHERE name = ''Contractor Alpha''), ''2026-01-05'', ''2026-01-15''
     FROM workers WHERE full_name = ''John Doe''',
    'conflicting key value violates exclusion constraint "wa_no_overlap"',
    'Should prevent overlapping affiliations'
);

SELECT * FROM finish();
ROLLBACK;
