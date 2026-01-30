-- Add "META Pullback" setup type for existing databases
INSERT INTO setup_types (name, color) VALUES
  ('META Pullback', '#ec4899')
ON CONFLICT (name) DO NOTHING;
