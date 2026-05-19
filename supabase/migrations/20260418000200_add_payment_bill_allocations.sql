-- Add bill-wise payment allocation and deduction breakup support

ALTER TABLE public.party_payment_receipts
  ADD COLUMN IF NOT EXISTS actual_received_amount NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS bill_allocations JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.party_payment_receipts
SET actual_received_amount = amount
WHERE actual_received_amount IS NULL;

ALTER TABLE public.party_payment_receipts
  ALTER COLUMN actual_received_amount SET NOT NULL;

ALTER TABLE public.party_payment_receipts
  ADD CONSTRAINT ppr_actual_received_amount_check
  CHECK (actual_received_amount >= 0 AND actual_received_amount <= amount);

ALTER TABLE public.party_payment_receipts
  ADD CONSTRAINT ppr_bill_allocations_is_array_check
  CHECK (jsonb_typeof(bill_allocations) = 'array');

CREATE OR REPLACE FUNCTION public.fn_validate_payment_bill_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_count integer;
  allocation jsonb;
  deduction_items jsonb;
  deduction_item jsonb;
  allocation_bill_id uuid;
  allocation_settled_amount numeric(14,2);
  allocation_received_amount numeric(14,2);
  deduction_total numeric(14,2);
  derived_bill_ids uuid[] := ARRAY[]::uuid[];
  allocations_total numeric(14,2) := 0;
  allocations_received_total numeric(14,2) := 0;
BEGIN
  IF NEW.bill_allocations IS NULL THEN
    NEW.bill_allocations := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.bill_allocations) <> 'array' THEN
    RAISE EXCEPTION 'bill_allocations must be a JSON array.';
  END IF;

  IF NEW.actual_received_amount IS NULL THEN
    NEW.actual_received_amount := NEW.amount;
  END IF;

  IF NEW.actual_received_amount < 0 THEN
    RAISE EXCEPTION 'actual_received_amount cannot be negative.';
  END IF;

  IF NEW.actual_received_amount > NEW.amount THEN
    RAISE EXCEPTION 'actual_received_amount cannot exceed the settled receipt amount.';
  END IF;

  IF jsonb_array_length(NEW.bill_allocations) > 0 THEN
    FOR allocation IN
      SELECT value
      FROM jsonb_array_elements(NEW.bill_allocations)
    LOOP
      IF jsonb_typeof(allocation) <> 'object' THEN
        RAISE EXCEPTION 'Each bill allocation must be a JSON object.';
      END IF;

      IF NULLIF(trim(allocation->>'billing_record_id'), '') IS NULL THEN
        RAISE EXCEPTION 'Each bill allocation requires billing_record_id.';
      END IF;

      allocation_bill_id := (allocation->>'billing_record_id')::uuid;
      allocation_settled_amount := ROUND(COALESCE((allocation->>'settled_amount')::numeric, 0), 2);
      allocation_received_amount := ROUND(COALESCE((allocation->>'received_amount')::numeric, 0), 2);

      IF allocation_settled_amount <= 0 THEN
        RAISE EXCEPTION 'Each bill allocation must have a positive settled_amount.';
      END IF;

      IF allocation_received_amount < 0 THEN
        RAISE EXCEPTION 'received_amount cannot be negative inside bill allocations.';
      END IF;

      deduction_items := COALESCE(allocation->'deduction_items', '[]'::jsonb);
      IF jsonb_typeof(deduction_items) <> 'array' THEN
        RAISE EXCEPTION 'deduction_items must be an array for each bill allocation.';
      END IF;

      deduction_total := 0;
      FOR deduction_item IN
        SELECT value
        FROM jsonb_array_elements(deduction_items)
      LOOP
        IF jsonb_typeof(deduction_item) <> 'object' THEN
          RAISE EXCEPTION 'Each deduction item must be a JSON object.';
        END IF;

        IF NULLIF(trim(deduction_item->>'label'), '') IS NULL THEN
          RAISE EXCEPTION 'Each deduction item requires a label.';
        END IF;

        IF ROUND(COALESCE((deduction_item->>'amount')::numeric, 0), 2) <= 0 THEN
          RAISE EXCEPTION 'Each deduction item must have a positive amount.';
        END IF;

        deduction_total := deduction_total + ROUND(COALESCE((deduction_item->>'amount')::numeric, 0), 2);
      END LOOP;

      IF ROUND(allocation_received_amount + deduction_total, 2) <> allocation_settled_amount THEN
        RAISE EXCEPTION 'For each bill allocation, settled_amount must equal received_amount plus deduction totals.';
      END IF;

      derived_bill_ids := array_append(derived_bill_ids, allocation_bill_id);
      allocations_total := allocations_total + allocation_settled_amount;
      allocations_received_total := allocations_received_total + allocation_received_amount;
    END LOOP;

    IF cardinality(derived_bill_ids) <> (
      SELECT COUNT(DISTINCT bill_id)
      FROM unnest(derived_bill_ids) AS bill_id
    ) THEN
      RAISE EXCEPTION 'The same bill cannot be allocated more than once inside a single payment receipt.';
    END IF;

    IF ROUND(allocations_total, 2) <> ROUND(NEW.amount, 2) THEN
      RAISE EXCEPTION 'The receipt amount must equal the total settled amount across bill allocations.';
    END IF;

    IF ROUND(allocations_received_total, 2) <> ROUND(NEW.actual_received_amount, 2) THEN
      RAISE EXCEPTION 'actual_received_amount must equal the total received amount across bill allocations.';
    END IF;

    NEW.related_billing_record_ids := derived_bill_ids;
  END IF;

  IF NEW.related_billing_record_ids IS NULL OR cardinality(NEW.related_billing_record_ids) = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO invalid_count
  FROM unnest(NEW.related_billing_record_ids) AS bill_id
  LEFT JOIN public.party_billing_records pbr
    ON pbr.id = bill_id
  WHERE pbr.id IS NULL
    OR pbr.party_id IS DISTINCT FROM NEW.party_id;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'All related billing records must belong to the same party as the payment receipt.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_protect_receipt_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Receipt amount is immutable. Reverse this receipt and create a new one instead.';
  END IF;

  IF OLD.actual_received_amount IS DISTINCT FROM NEW.actual_received_amount THEN
    RAISE EXCEPTION 'Received amount is immutable. Reverse this receipt and create a new one instead.';
  END IF;

  IF OLD.bill_allocations IS DISTINCT FROM NEW.bill_allocations THEN
    RAISE EXCEPTION 'Bill allocation breakup is immutable. Reverse this receipt and create a new one instead.';
  END IF;

  IF OLD.related_billing_record_ids IS DISTINCT FROM NEW.related_billing_record_ids THEN
    RAISE EXCEPTION 'Bill links are immutable on a payment receipt.';
  END IF;

  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a payment receipt.';
  END IF;

  IF OLD.party_ledger_account_id IS DISTINCT FROM NEW.party_ledger_account_id THEN
    RAISE EXCEPTION 'Ledger account cannot be changed on a payment receipt.';
  END IF;

  IF OLD.status = 'REVERSED' AND NEW.status IS DISTINCT FROM 'REVERSED' THEN
    RAISE EXCEPTION 'Reversed payment receipts cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;
