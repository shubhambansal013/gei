-- 20260423000004_items_stock_unit.sql
-- Items master gains a canonical stock unit and default conversion factor.
--
-- Motivation:
--   Construction stores receive materials in one unit (e.g. a 100m ROLL of
--   wire) but track and issue in another (e.g. METRES). Today the `items`
--   table stores a single `unit` column while every `purchases` row
--   re-declares `received_unit`, `stock_unit`, and `unit_conv_factor`.
--   That forces non-technical users to re-enter conversion info on every
--   inward. We lift the canonical stock unit + default multiplier onto
--   the item so the inward form can default-fill them.
--
-- Changes:
--   * items.unit           -> items.stock_unit   (RENAME; Postgres
--     propagates the rename to dependent views such as stock_balance.)
--   * items.stock_conv_factor NUMERIC NOT NULL DEFAULT 1
--     CHECK (stock_conv_factor > 0)
--   * Reinforce the existing purchases.unit_conv_factor > 0 invariant
--     with a named CHECK constraint so future override rows cannot
--     introduce a zero/negative multiplier via data repair scripts.

BEGIN;

ALTER TABLE items RENAME COLUMN unit TO stock_unit;

ALTER TABLE items
  ADD COLUMN stock_conv_factor NUMERIC NOT NULL DEFAULT 1
    CHECK (stock_conv_factor > 0);

ALTER TABLE purchases
  ADD CONSTRAINT chk_purchases_unit_conv_factor_positive
    CHECK (unit_conv_factor > 0);

COMMIT;
