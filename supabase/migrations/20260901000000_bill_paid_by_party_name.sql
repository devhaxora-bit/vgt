-- Add optional free-text "paid by other party" name to billing records.
-- This is a display/tracking field only — no ledger or payment logic is affected.

ALTER TABLE public.party_billing_records
  ADD COLUMN IF NOT EXISTS paid_by_party_name TEXT;

COMMENT ON COLUMN public.party_billing_records.paid_by_party_name IS
  'Optional. Free-text name of the party that actually paid this bill when different from the billed party.';
