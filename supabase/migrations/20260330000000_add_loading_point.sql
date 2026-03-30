-- Add loading_point column to consignments table
ALTER TABLE public.consignments ADD COLUMN IF NOT EXISTS loading_point TEXT;
