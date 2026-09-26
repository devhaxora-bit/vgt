-- Ensure active payment receipts can be edited (amount, allocations, links).
-- Idempotent: recreates the protect trigger function in the edit-allowing form.
-- Reversed receipts stay locked; branch_code stays frozen.

CREATE OR REPLACE FUNCTION public.fn_protect_receipt_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be greater than zero.';
  END IF;

  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a payment receipt.';
  END IF;

  IF OLD.status = 'REVERSED' AND NEW.status IS DISTINCT FROM 'REVERSED' THEN
    RAISE EXCEPTION 'Reversed payment receipts cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;
