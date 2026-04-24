-- Move stock_conv_factor from items to purchases
-- Removed from items table as conversion factor is now transaction-specific

ALTER TABLE items DROP COLUMN IF EXISTS stock_conv_factor;
