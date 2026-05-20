-- Migration: Reassign sequential party codes (000001, 000002, ...)
-- and sync billing_party_code in consignments to match new codes.
-- Run: 20260520143000_sequential_party_codes.sql

-- STEP 1: Temporarily drop the UNIQUE constraint so we can reassign
-- (we'll recreate it after)
ALTER TABLE parties DROP CONSTRAINT IF EXISTS parties_code_key;
DROP INDEX IF EXISTS idx_parties_code;

-- STEP 3: Reassign sequential zero-padded codes ordered by created_at
WITH ranked AS (
  SELECT
    id,
    LPAD(ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC)::TEXT, 6, '0') AS new_code
  FROM parties
)
UPDATE parties p
SET code = r.new_code
FROM ranked r
WHERE p.id = r.id;

-- STEP 4: Sync billing_party_code in consignments to the new codes
-- (billing_party_id FK already links consignment → party.id, so we use that)
UPDATE consignments c
SET billing_party_code = p.code
FROM parties p
WHERE c.billing_party_id = p.id
  AND c.billing_party_id IS NOT NULL;

-- STEP 5: Recreate the UNIQUE constraint and index
ALTER TABLE parties ADD CONSTRAINT parties_code_key UNIQUE (code);
CREATE INDEX IF NOT EXISTS idx_parties_code ON parties(code);

-- STEP 6: Add a DB sequence so future inserts can use MAX(code)+1 safely
-- (The app will handle this via SELECT MAX(code) + 1, but we document here)
COMMENT ON COLUMN parties.code IS 
  'Zero-padded 6-digit sequential code: 000001, 000002, etc. 
   New codes are assigned as LPAD((MAX(code)::INT + 1)::TEXT, 6, 0) by the app.';
