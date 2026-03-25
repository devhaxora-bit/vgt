-- Add delivery_point to consignments
ALTER TABLE consignments ADD COLUMN IF NOT EXISTS delivery_point TEXT;
