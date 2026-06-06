ALTER TABLE public.party_billing_records
ADD COLUMN IF NOT EXISTS vehicle_cancel_items JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.party_billing_records
ADD COLUMN IF NOT EXISTS vehicle_cancel_charges_total NUMERIC(14,2) NOT NULL DEFAULT 0;

UPDATE public.party_billing_records
SET vehicle_cancel_items = '[]'::jsonb
WHERE vehicle_cancel_items IS NULL;

UPDATE public.party_billing_records
SET vehicle_cancel_charges_total = 0
WHERE vehicle_cancel_charges_total IS NULL;

ALTER TABLE public.party_billing_records
DROP CONSTRAINT IF EXISTS party_billing_records_vehicle_cancel_items_is_array;

ALTER TABLE public.party_billing_records
ADD CONSTRAINT party_billing_records_vehicle_cancel_items_is_array
CHECK (jsonb_typeof(vehicle_cancel_items) = 'array');

ALTER TABLE public.party_billing_records
DROP CONSTRAINT IF EXISTS party_billing_records_vehicle_cancel_charges_total_non_negative;

ALTER TABLE public.party_billing_records
ADD CONSTRAINT party_billing_records_vehicle_cancel_charges_total_non_negative
CHECK (vehicle_cancel_charges_total >= 0);

CREATE OR REPLACE FUNCTION public.fn_validate_billing_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  distinct_cn_count integer := 0;
  matched_cn_count integer := 0;
  overlapping_bill_ref text;
  has_active_linked_payment boolean := false;
  normalized_vehicle_cancel_total numeric := 0;
BEGIN
  IF NEW.covered_cn_nos IS NOT NULL THEN
    NEW.covered_cn_nos := ARRAY(
      SELECT trimmed_cn
      FROM (
        SELECT trim(cn_no) AS trimmed_cn, ord
        FROM unnest(NEW.covered_cn_nos) WITH ORDINALITY AS input(cn_no, ord)
        WHERE trim(cn_no) <> ''
      ) normalized
      ORDER BY ord
    );

    IF cardinality(NEW.covered_cn_nos) = 0 THEN
      NEW.covered_cn_nos := NULL;
    END IF;
  END IF;

  IF NEW.consignment_snapshot IS NULL THEN
    NEW.consignment_snapshot := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.consignment_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'consignment_snapshot must be a JSON array.';
  END IF;

  IF NEW.vehicle_cancel_items IS NULL THEN
    NEW.vehicle_cancel_items := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.vehicle_cancel_items) <> 'array' THEN
    RAISE EXCEPTION 'vehicle_cancel_items must be a JSON array.';
  END IF;

  SELECT COALESCE(SUM(ROUND(COALESCE((item ->> 'charges')::numeric, 0), 2)), 0)
  INTO normalized_vehicle_cancel_total
  FROM jsonb_array_elements(NEW.vehicle_cancel_items) AS item
  WHERE COALESCE(trim(item ->> 'vehicle_no'), '') <> ''
     OR COALESCE(trim(item ->> 'from_station'), '') <> ''
     OR COALESCE(trim(item ->> 'to_station'), '') <> ''
     OR COALESCE(trim(item ->> 'cancellation_date'), '') <> ''
     OR COALESCE((item ->> 'charges')::numeric, 0) > 0;

  NEW.vehicle_cancel_charges_total := ROUND(COALESCE(normalized_vehicle_cancel_total, 0), 2);
  NEW.cn_total_amount := ROUND(COALESCE(NEW.cn_total_amount, 0), 2);
  NEW.added_other_charges_amount := ROUND(COALESCE(NEW.added_other_charges_amount, 0), 2);
  NEW.amount := ROUND(COALESCE(NEW.amount, 0), 2);

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
  END IF;

  IF ROUND(NEW.cn_total_amount + NEW.added_other_charges_amount + NEW.vehicle_cancel_charges_total, 2) <> NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount must equal cn_total_amount plus added_other_charges_amount plus vehicle_cancel_charges_total.';
  END IF;

  IF NEW.covered_cn_nos IS NULL OR cardinality(NEW.covered_cn_nos) = 0 THEN
    IF NEW.cn_total_amount <> 0 THEN
      RAISE EXCEPTION 'cn_total_amount must be zero when no covered CNs are linked.';
    END IF;

    IF jsonb_array_length(NEW.consignment_snapshot) <> 0 THEN
      RAISE EXCEPTION 'consignment_snapshot must be empty when no covered CNs are linked.';
    END IF;
  ELSE
    SELECT COUNT(*) INTO distinct_cn_count
    FROM (
      SELECT DISTINCT cn_no
      FROM unnest(NEW.covered_cn_nos) AS cn_no
    ) unique_cns;

    IF distinct_cn_count <> cardinality(NEW.covered_cn_nos) THEN
      RAISE EXCEPTION 'covered_cn_nos must not contain duplicates.';
    END IF;

    SELECT COUNT(*) INTO matched_cn_count
    FROM (
      SELECT DISTINCT c.cn_no
      FROM public.consignments c
      WHERE c.billing_party_id = NEW.party_id
        AND c.cancel_cn = false
        AND c.cn_no = ANY(NEW.covered_cn_nos)
    ) matched_cns;

    IF matched_cn_count <> distinct_cn_count THEN
      RAISE EXCEPTION 'Every covered CN must belong to the same billing party and remain active.';
    END IF;

    IF jsonb_array_length(NEW.consignment_snapshot) <> cardinality(NEW.covered_cn_nos) THEN
      RAISE EXCEPTION 'consignment_snapshot must include one row per covered CN.';
    END IF;

    IF NEW.status = 'ACTIVE' THEN
      SELECT COALESCE(pbr.bill_ref_no, pbr.id::text)
      INTO overlapping_bill_ref
      FROM public.party_billing_records pbr
      WHERE pbr.party_id = NEW.party_id
        AND pbr.status = 'ACTIVE'
        AND pbr.id IS DISTINCT FROM NEW.id
        AND pbr.covered_cn_nos && NEW.covered_cn_nos
      LIMIT 1;

      IF overlapping_bill_ref IS NOT NULL THEN
        RAISE EXCEPTION 'Covered CNs are already billed on active bill %.', overlapping_bill_ref;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.party_payment_receipts ppr
      WHERE ppr.party_id = OLD.party_id
        AND ppr.status = 'ACTIVE'
        AND (
          ppr.related_billing_record_ids @> ARRAY[OLD.id]::uuid[]
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(ppr.bill_allocations, '[]'::jsonb)) AS allocation
            WHERE allocation ->> 'billing_record_id' = OLD.id::text
          )
        )
    )
    INTO has_active_linked_payment;

    IF has_active_linked_payment AND (
      OLD.amount IS DISTINCT FROM NEW.amount
      OR OLD.billing_date IS DISTINCT FROM NEW.billing_date
      OR OLD.billing_period_from IS DISTINCT FROM NEW.billing_period_from
      OR OLD.billing_period_to IS DISTINCT FROM NEW.billing_period_to
      OR OLD.bill_ref_no IS DISTINCT FROM NEW.bill_ref_no
      OR OLD.narration IS DISTINCT FROM NEW.narration
      OR OLD.covered_cn_nos IS DISTINCT FROM NEW.covered_cn_nos
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.cn_total_amount IS DISTINCT FROM NEW.cn_total_amount
      OR OLD.added_other_charges_amount IS DISTINCT FROM NEW.added_other_charges_amount
      OR OLD.vehicle_cancel_charges_total IS DISTINCT FROM NEW.vehicle_cancel_charges_total
      OR OLD.vehicle_cancel_items IS DISTINCT FROM NEW.vehicle_cancel_items
      OR OLD.consignment_snapshot IS DISTINCT FROM NEW.consignment_snapshot
    ) THEN
      RAISE EXCEPTION 'Bills with active linked payments cannot be edited or cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
