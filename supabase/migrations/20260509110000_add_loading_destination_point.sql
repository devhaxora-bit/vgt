-- Add loading_point and destination_point to challans table
ALTER TABLE challans
ADD COLUMN IF NOT EXISTS loading_point TEXT,
ADD COLUMN IF NOT EXISTS destination_point TEXT;
