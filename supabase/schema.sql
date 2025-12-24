-- Create tables for trade journal app with positions and exits

-- Accounts table
CREATE TABLE IF NOT EXISTS accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL UNIQUE,
  starting_capital DECIMAL(12, 2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Setup types table
CREATE TABLE IF NOT EXISTS setup_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Positions table (entries)
CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('long', 'short')),
  entry_date DATE NOT NULL,
  entry_price DECIMAL(12, 4) NOT NULL,
  total_shares INTEGER NOT NULL,
  entry_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  stop_price DECIMAL(12, 4) NOT NULL,
  setup_type TEXT NOT NULL,
  ncfd_reading INTEGER NOT NULL CHECK (ncfd_reading >= 0 AND ncfd_reading <= 100),
  market_cycle TEXT NOT NULL CHECK (market_cycle IN ('green', 'red')),
  notes TEXT,
  chart_url TEXT,
  current_price DECIMAL(12, 4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Exits table (partial or full sells)
CREATE TABLE IF NOT EXISTS exits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_id UUID NOT NULL REFERENCES positions(id) ON DELETE CASCADE,
  exit_date DATE NOT NULL,
  exit_price DECIMAL(12, 4) NOT NULL,
  shares_sold INTEGER NOT NULL CHECK (shares_sold > 0),
  exit_fee DECIMAL(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_positions_entry_date ON positions(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_positions_setup_type ON positions(setup_type);
CREATE INDEX IF NOT EXISTS idx_positions_market_cycle ON positions(market_cycle);
CREATE INDEX IF NOT EXISTS idx_positions_ticker ON positions(ticker);
CREATE INDEX IF NOT EXISTS idx_exits_position_id ON exits(position_id);
CREATE INDEX IF NOT EXISTS idx_exits_exit_date ON exits(exit_date DESC);

-- Insert default setup types
INSERT INTO setup_types (name, color) VALUES
  ('Delayed Reaction', '#3b82f6'),
  ('VCP', '#8b5cf6'),
  ('Breakout', '#10b981'),
  ('Earnings', '#f59e0b'),
  ('Other', '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- Insert default account for current year
INSERT INTO accounts (year, starting_capital) VALUES
  (EXTRACT(YEAR FROM NOW())::INTEGER, 100000.00)
ON CONFLICT (year) DO NOTHING;

-- Enable Row Level Security (optional - for future auth)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exits ENABLE ROW LEVEL SECURITY;
ALTER TABLE setup_types ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (modify these when adding auth)
CREATE POLICY "Allow all operations on accounts" ON accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on positions" ON positions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on exits" ON exits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on setup_types" ON setup_types FOR ALL USING (true) WITH CHECK (true);
