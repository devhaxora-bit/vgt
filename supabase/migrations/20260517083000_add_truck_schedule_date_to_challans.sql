-- Migration: Add truck_schedule_date field to challans
-- Stores the date the truck is scheduled to reach the destination

ALTER TABLE public.challans
ADD COLUMN IF NOT EXISTS truck_schedule_date date DEFAULT NULL;
