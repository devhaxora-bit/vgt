-- Migration: Add traffic_challan_charges field to consignments
-- Stores specific charges for traffic challans associated with a consignment

ALTER TABLE public.consignments
ADD COLUMN IF NOT EXISTS traffic_challan_charges numeric DEFAULT 0;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
