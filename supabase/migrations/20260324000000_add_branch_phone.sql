-- Add phone column to branches table
ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
