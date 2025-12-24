-- Add chart_url column to positions table
ALTER TABLE positions ADD COLUMN IF NOT EXISTS chart_url TEXT;
