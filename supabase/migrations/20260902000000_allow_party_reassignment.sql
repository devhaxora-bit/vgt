-- Allow party reassignment on billing records and payment receipts.
-- Admin-only API endpoints handle the validation and cascade logic.
-- The composite FK (party_ledger_account_id, party_id) already guarantees
-- that any update must use a matching (account, party) pair in party_ledger_accounts.

-- Billing records: keep amount > 0, branch immutability, and CANCELLED-lock.
-- Remove: party_id and party_ledger_account_id immutability.
CREATE OR REPLACE FUNCTION public.fn_protect_billing_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
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

-- Payment receipts: keep amount immutable, REVERSED-lock.
-- Remove: party_id and party_ledger_account_id immutability.
CREATE OR REPLACE FUNCTION public.fn_protect_receipt_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Receipt amount is immutable. Reverse this receipt and create a new one instead.';
  END IF;

  IF OLD.status = 'REVERSED' AND NEW.status IS DISTINCT FROM 'REVERSED' THEN
    RAISE EXCEPTION 'Reversed payment receipts cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;
