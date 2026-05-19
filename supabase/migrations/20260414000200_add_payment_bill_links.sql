-- Add optional bill linkage on payment receipts

ALTER TABLE public.party_payment_receipts
  ADD COLUMN IF NOT EXISTS related_billing_record_ids UUID[];

CREATE INDEX IF NOT EXISTS idx_ppr_related_billing_record_ids
  ON public.party_payment_receipts
  USING GIN (related_billing_record_ids);

CREATE OR REPLACE FUNCTION public.fn_validate_payment_bill_links()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  invalid_count integer;
BEGIN
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

DROP TRIGGER IF EXISTS trg_validate_payment_bill_links ON public.party_payment_receipts;

CREATE TRIGGER trg_validate_payment_bill_links
  BEFORE INSERT OR UPDATE ON public.party_payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_payment_bill_links();
