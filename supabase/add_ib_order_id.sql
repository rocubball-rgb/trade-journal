-- Add IBOrderID tracking for CSV imports
ALTER TABLE positions ADD COLUMN IF NOT EXISTS ib_order_id TEXT UNIQUE;
ALTER TABLE exits ADD COLUMN IF NOT EXISTS ib_order_id TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS idx_positions_ib_order_id ON positions(ib_order_id);
CREATE INDEX IF NOT EXISTS idx_exits_ib_order_id ON exits(ib_order_id);
