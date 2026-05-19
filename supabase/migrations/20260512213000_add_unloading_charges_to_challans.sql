-- Migration: Add unloading_charges field to challans
-- Generated to support dynamic loading and billing tracking

ALTER TABLE public.challans
ADD COLUMN IF NOT EXISTS unloading_charges numeric DEFAULT 0;
