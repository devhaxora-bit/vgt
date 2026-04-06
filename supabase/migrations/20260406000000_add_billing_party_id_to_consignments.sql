-- Add billing_party_id FK to consignments for clean ledger linkage
-- This links the billing party (from CNS entry) to the parties master table

ALTER TABLE consignments
  ADD COLUMN IF NOT EXISTS billing_party_id UUID REFERENCES parties(id) ON DELETE SET NULL;

-- Backfill from existing data where billing_party_code matches parties.code
UPDATE consignments c
SET billing_party_id = p.id
FROM parties p
WHERE UPPER(TRIM(c.billing_party_code)) = UPPER(TRIM(p.code))
  AND c.billing_party_id IS NULL;

-- Indexes for ledger query performance
CREATE INDEX IF NOT EXISTS idx_cns_billing_party_id
  ON consignments(billing_party_id);

CREATE INDEX IF NOT EXISTS idx_cns_billing_party_bkg_date
  ON consignments(billing_party_id, bkg_date DESC);
