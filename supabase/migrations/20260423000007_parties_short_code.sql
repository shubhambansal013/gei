-- 20260423000007_parties_short_code.sql
-- Issue #19 — optional, unique-when-set short code for parties.
--
-- Site-store workers often refer to a contractor by a 2–3 letter
-- shorthand ("ABC", "MEP", "VAI"). The canonical `name` column is too
-- long to scan in a SearchableSelect dropdown at entry time; a
-- dedicated `short_code` gives a fast-typing key that still round-trips
-- to a human-readable name.
--
-- Constraints:
--   * Optional — NULLable, no default.
--   * When set: 2–8 uppercase letters or digits (no hyphens, no spaces).
--   * Uniqueness is enforced via a partial UNIQUE index (only non-NULL
--     values participate) so multiple NULLs remain legal.
--
-- Note on CONCURRENTLY: Supabase migration files run inside a single
-- transaction; `CREATE INDEX CONCURRENTLY` cannot. The table is small
-- and infrequently written, so a plain UNIQUE INDEX is fine here.

BEGIN;

ALTER TABLE parties
  ADD COLUMN short_code TEXT;

ALTER TABLE parties
  ADD CONSTRAINT parties_short_code_fmt
  CHECK (short_code IS NULL OR short_code ~ '^[A-Z0-9]{2,8}$');

CREATE UNIQUE INDEX parties_short_code_uk
  ON parties(short_code)
  WHERE short_code IS NOT NULL;

COMMIT;
