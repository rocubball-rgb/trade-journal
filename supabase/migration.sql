-- Migration to update positions table schema
-- Run this if you have existing data

-- Step 1: Add the new market_cycle column
ALTER TABLE positions ADD COLUMN IF NOT EXISTS market_cycle TEXT CHECK (market_cycle IN ('green', 'red'));

-- Step 2: Set default values for existing rows (you can adjust the default)
UPDATE positions SET market_cycle = 'green' WHERE market_cycle IS NULL;

-- Step 3: Make market_cycle NOT NULL after setting defaults
ALTER TABLE positions ALTER COLUMN market_cycle SET NOT NULL;

-- Step 4: Drop the old columns
ALTER TABLE positions DROP COLUMN IF EXISTS fomo_level;
ALTER TABLE positions DROP COLUMN IF EXISTS edge_type;

-- Step 5: Drop old index and create new one
DROP INDEX IF EXISTS idx_positions_edge_type;
CREATE INDEX IF NOT EXISTS idx_positions_market_cycle ON positions(market_cycle);
