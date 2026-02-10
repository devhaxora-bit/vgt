-- Add owner_type column to challans table
ALTER TABLE challans 
ADD COLUMN IF NOT EXISTS owner_type TEXT DEFAULT 'MARKET';
