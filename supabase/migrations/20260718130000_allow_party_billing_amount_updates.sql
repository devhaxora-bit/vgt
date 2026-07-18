-- Restore bill amount updates for party ledger edits.
-- 20260715170000 reintroduced "amount is immutable", which blocks adding/removing
-- CNs on an existing ACTIVE bill (amount changes with the snapshot rebuild).

CREATE OR REPLACE FUNCTION public.fn_protect_billing_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
  END IF;

  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a billing record.';
  END IF;

  IF OLD.party_ledger_account_id IS DISTINCT FROM NEW.party_ledger_account_id THEN
    RAISE EXCEPTION 'Ledger account cannot be changed on a billing record.';
  END IF;

  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a billing record.';
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status IS DISTINCT FROM 'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled billing records cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;
