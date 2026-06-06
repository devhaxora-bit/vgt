-- Add parent-child linking for CN freight include feature
-- A child CN can "include" its freight in a parent CN.
-- When freight_included = true, the child CN's freight fields are all zero,
-- and it references the parent CN via parent_cn_id.

ALTER TABLE consignments
  ADD COLUMN IF NOT EXISTS parent_cn_id UUID REFERENCES consignments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS freight_included BOOLEAN NOT NULL DEFAULT false;

-- Index for efficiently finding children of a parent CN
CREATE INDEX IF NOT EXISTS idx_consignments_parent_cn_id
  ON consignments(parent_cn_id)
  WHERE parent_cn_id IS NOT NULL;

-- Ensure a CN with parent_cn_id always has freight_included = true
ALTER TABLE consignments
  ADD CONSTRAINT chk_freight_included_consistency
  CHECK (
    (parent_cn_id IS NULL AND freight_included = false)
    OR (parent_cn_id IS NOT NULL AND freight_included = true)
  );
