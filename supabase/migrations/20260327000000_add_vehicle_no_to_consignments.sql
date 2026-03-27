-- Add vehicle_no to consignments table
ALTER TABLE consignments ADD COLUMN IF NOT EXISTS vehicle_no VARCHAR(30);
