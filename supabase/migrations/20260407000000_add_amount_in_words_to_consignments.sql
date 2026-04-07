-- Add amount_in_words column to consignments table
ALTER TABLE consignments
ADD COLUMN IF NOT EXISTS amount_in_words TEXT;
