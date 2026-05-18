-- Harden party ledger integrity and audit rules

-- Ensure child rows always reference the ledger account for the same party.
ALTER TABLE public.party_ledger_accounts
  ADD CONSTRAINT party_ledger_accounts_id_party_id_key UNIQUE (id, party_id);

UPDATE public.party_billing_records pbr
SET party_ledger_account_id = pla.id
FROM public.party_ledger_accounts pla
WHERE pbr.party_id = pla.party_id
  AND pbr.party_ledger_account_id IS DISTINCT FROM pla.id;

UPDATE public.party_payment_receipts ppr
SET party_ledger_account_id = pla.id
FROM public.party_ledger_accounts pla
WHERE ppr.party_id = pla.party_id
  AND ppr.party_ledger_account_id IS DISTINCT FROM pla.id;

ALTER TABLE public.party_billing_records
  ADD CONSTRAINT pbr_party_account_match_fk
  FOREIGN KEY (party_ledger_account_id, party_id)
  REFERENCES public.party_ledger_accounts (id, party_id);

ALTER TABLE public.party_payment_receipts
  ADD CONSTRAINT ppr_party_account_match_fk
  FOREIGN KEY (party_ledger_account_id, party_id)
  REFERENCES public.party_ledger_accounts (id, party_id);

ALTER TABLE public.party_billing_records
  ADD CONSTRAINT pbr_cancel_audit_check
  CHECK (
    (status = 'ACTIVE' AND cancel_reason IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR
    (status = 'CANCELLED' AND cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
  );

ALTER TABLE public.party_payment_receipts
  ADD CONSTRAINT ppr_reversal_audit_check
  CHECK (
    (status = 'ACTIVE' AND reversal_reason IS NULL AND reversed_at IS NULL AND reversed_by IS NULL)
    OR
    (status = 'REVERSED' AND reversal_reason IS NOT NULL AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION public.fn_protect_billing_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount is immutable. Cancel this record and create a new one instead.';
  END IF;

  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a billing record.';
  END IF;

  IF OLD.party_ledger_account_id IS DISTINCT FROM NEW.party_ledger_account_id THEN
    RAISE EXCEPTION 'Ledger account cannot be changed on a billing record.';
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status IS DISTINCT FROM 'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled billing records cannot be reactivated.';
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

DROP VIEW IF EXISTS public.vw_party_ledger_summary;

CREATE VIEW public.vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
  p.type                                  AS party_type,
  p.phone,
  p.branch_code,
  p.is_active                             AS party_active,
  pla.id                                  AS ledger_account_id,
  pla.opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,
  COALESCE(cns_agg.total_freight, 0)      AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  COALESCE(cns_agg.total_freight, 0)
    - COALESCE(bill_agg.total_billed, 0)  AS unbilled_amount,
  pla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding
FROM public.parties p
JOIN public.party_ledger_accounts pla ON pla.party_id = p.id
LEFT JOIN LATERAL (
  SELECT
    SUM(c.total_freight) AS total_freight,
    COUNT(c.id)          AS cns_count
  FROM public.consignments c
  WHERE c.billing_party_id = p.id
    AND c.cancel_cn = false
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(pbr.amount) AS total_billed
  FROM public.party_billing_records pbr
  WHERE pbr.party_id = p.id
    AND pbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(ppr.amount) AS total_paid
  FROM public.party_payment_receipts ppr
  WHERE ppr.party_id = p.id
    AND ppr.status = 'ACTIVE'
) pay_agg ON true
WHERE
  p.is_active = true
  OR pla.opening_balance <> 0
  OR COALESCE(cns_agg.total_freight, 0) <> 0
  OR COALESCE(bill_agg.total_billed, 0) <> 0
  OR COALESCE(pay_agg.total_paid, 0) <> 0;

DROP POLICY IF EXISTS "Allow read access to parties for authenticated users" ON public.parties;

CREATE POLICY "Allow authenticated users to read active or ledger-relevant parties"
ON public.parties
FOR SELECT
TO authenticated
USING (
  is_active = true
  OR EXISTS (
    SELECT 1
    FROM public.party_ledger_accounts pla
    WHERE pla.party_id = parties.id
      AND pla.opening_balance <> 0
  )
  OR EXISTS (
    SELECT 1
    FROM public.party_billing_records pbr
    WHERE pbr.party_id = parties.id
      AND pbr.status = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1
    FROM public.party_payment_receipts ppr
    WHERE ppr.party_id = parties.id
      AND ppr.status = 'ACTIVE'
  )
  OR EXISTS (
    SELECT 1
    FROM public.consignments c
    WHERE c.billing_party_id = parties.id
      AND c.cancel_cn = false
  )
);
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
ALTER TABLE public.party_billing_records
ADD COLUMN IF NOT EXISTS extra_charge_items JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.party_billing_records
SET extra_charge_items = '[]'::jsonb
WHERE extra_charge_items IS NULL;

ALTER TABLE public.party_billing_records
DROP CONSTRAINT IF EXISTS party_billing_records_extra_charge_items_is_array;

ALTER TABLE public.party_billing_records
ADD CONSTRAINT party_billing_records_extra_charge_items_is_array
CHECK (jsonb_typeof(extra_charge_items) = 'array');
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
-- Allow billing amounts to be updated during bill edits

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

  IF OLD.status = 'CANCELLED' AND NEW.status IS DISTINCT FROM 'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled billing records cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;
-- Harden billing lifecycle, snapshot historical bill rows, and fix unbilled math

ALTER TABLE public.party_billing_records
  ADD COLUMN IF NOT EXISTS cn_total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS added_other_charges_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS consignment_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.party_billing_records
SET
  cn_total_amount = COALESCE(cn_total_amount, 0),
  added_other_charges_amount = COALESCE(added_other_charges_amount, 0),
  consignment_snapshot = COALESCE(consignment_snapshot, '[]'::jsonb)
WHERE
  cn_total_amount IS NULL
  OR added_other_charges_amount IS NULL
  OR consignment_snapshot IS NULL;

ALTER TABLE public.party_billing_records
  DROP CONSTRAINT IF EXISTS pbr_consignment_snapshot_is_array_check;

ALTER TABLE public.party_billing_records
  ADD CONSTRAINT pbr_consignment_snapshot_is_array_check
  CHECK (jsonb_typeof(consignment_snapshot) = 'array');

CREATE INDEX IF NOT EXISTS idx_pbr_covered_cn_nos_gin
  ON public.party_billing_records
  USING GIN (covered_cn_nos);

WITH ordered_consignments AS (
  SELECT
    pbr.id AS billing_record_id,
    pbr.amount,
    cn.ord,
    trim(cn.cn_no) AS requested_cn_no,
    COALESCE(c.cn_no, trim(cn.cn_no)) AS cn_no,
    c.bkg_date,
    COALESCE(c.invoice_no, c.cn_no, trim(cn.cn_no)) AS invoice_no,
    c.vehicle_no,
    c.booking_branch,
    COALESCE(c.loading_point, c.booking_branch) AS loading_station,
    COALESCE(c.delivery_point, c.dest_branch) AS delivery_station,
    CASE
      WHEN COALESCE(c.charged_weight, c.actual_weight, 0) > 0 THEN
        trim(concat(COALESCE(c.charged_weight, c.actual_weight)::text, ' ', upper(COALESCE(c.load_unit, ''))))
      ELSE NULL
    END AS charge_wt,
    ROUND(COALESCE(c.freight_rate, 0), 2) AS freight_rate,
    ROUND(
      CASE
        WHEN c.id IS NULL THEN 0
        WHEN COALESCE(c.basic_freight, 0) > 0 THEN COALESCE(c.basic_freight, 0)
        ELSE
          CASE
            WHEN COALESCE(c.total_freight, 0)
              - COALESCE(c.retention_charges, 0)
              - COALESCE(c.unload_charges, 0)
              - COALESCE(c.extra_km_charges, 0)
              - COALESCE(c.mhc_charges, 0)
              - COALESCE(c.door_coll_charges, 0)
              - COALESCE(c.door_del_charges, 0)
              - COALESCE(c.other_charges, 0) > 0
            THEN COALESCE(c.total_freight, 0)
              - COALESCE(c.retention_charges, 0)
              - COALESCE(c.unload_charges, 0)
              - COALESCE(c.extra_km_charges, 0)
              - COALESCE(c.mhc_charges, 0)
              - COALESCE(c.door_coll_charges, 0)
              - COALESCE(c.door_del_charges, 0)
              - COALESCE(c.other_charges, 0)
            ELSE COALESCE(c.total_freight, 0)
          END
      END
    , 2) AS freight,
    ROUND(COALESCE(c.unload_charges, 0), 2) AS unloading,
    ROUND(COALESCE(c.retention_charges, 0), 2) AS detention,
    ROUND(COALESCE(c.extra_km_charges, 0), 2) AS extra_km,
    ROUND(COALESCE(c.mhc_charges, 0), 2) AS loading,
    ROUND(COALESCE(c.door_coll_charges, 0), 2) AS door_collection,
    ROUND(COALESCE(c.door_del_charges, 0), 2) AS door_delivery,
    ROUND(COALESCE(c.other_charges, 0), 2) AS other_charges,
    ROUND(
      CASE
        WHEN c.id IS NULL THEN 0
        WHEN COALESCE(c.total_freight, 0) > 0 THEN COALESCE(c.total_freight, 0)
        ELSE
          (
            CASE
              WHEN COALESCE(c.basic_freight, 0) > 0 THEN COALESCE(c.basic_freight, 0)
              ELSE
                CASE
                  WHEN COALESCE(c.total_freight, 0)
                    - COALESCE(c.retention_charges, 0)
                    - COALESCE(c.unload_charges, 0)
                    - COALESCE(c.extra_km_charges, 0)
                    - COALESCE(c.mhc_charges, 0)
                    - COALESCE(c.door_coll_charges, 0)
                    - COALESCE(c.door_del_charges, 0)
                    - COALESCE(c.other_charges, 0) > 0
                  THEN COALESCE(c.total_freight, 0)
                    - COALESCE(c.retention_charges, 0)
                    - COALESCE(c.unload_charges, 0)
                    - COALESCE(c.extra_km_charges, 0)
                    - COALESCE(c.mhc_charges, 0)
                    - COALESCE(c.door_coll_charges, 0)
                    - COALESCE(c.door_del_charges, 0)
                    - COALESCE(c.other_charges, 0)
                  ELSE COALESCE(c.total_freight, 0)
                END
            END
          )
          + COALESCE(c.unload_charges, 0)
          + COALESCE(c.retention_charges, 0)
          + COALESCE(c.extra_km_charges, 0)
          + COALESCE(c.mhc_charges, 0)
          + COALESCE(c.door_coll_charges, 0)
          + COALESCE(c.door_del_charges, 0)
          + COALESCE(c.other_charges, 0)
      END
    , 2) AS total_amount,
    ROW_NUMBER() OVER (PARTITION BY pbr.id ORDER BY cn.ord) AS row_num,
    COUNT(*) OVER (PARTITION BY pbr.id) AS row_count,
    SUM(
      ROUND(
        CASE
          WHEN c.id IS NULL THEN 0
          WHEN COALESCE(c.total_freight, 0) > 0 THEN COALESCE(c.total_freight, 0)
          ELSE
            (
              CASE
                WHEN COALESCE(c.basic_freight, 0) > 0 THEN COALESCE(c.basic_freight, 0)
                ELSE
                  CASE
                    WHEN COALESCE(c.total_freight, 0)
                      - COALESCE(c.retention_charges, 0)
                      - COALESCE(c.unload_charges, 0)
                      - COALESCE(c.extra_km_charges, 0)
                      - COALESCE(c.mhc_charges, 0)
                      - COALESCE(c.door_coll_charges, 0)
                      - COALESCE(c.door_del_charges, 0)
                      - COALESCE(c.other_charges, 0) > 0
                    THEN COALESCE(c.total_freight, 0)
                      - COALESCE(c.retention_charges, 0)
                      - COALESCE(c.unload_charges, 0)
                      - COALESCE(c.extra_km_charges, 0)
                      - COALESCE(c.mhc_charges, 0)
                      - COALESCE(c.door_coll_charges, 0)
                      - COALESCE(c.door_del_charges, 0)
                      - COALESCE(c.other_charges, 0)
                    ELSE COALESCE(c.total_freight, 0)
                  END
              END
            )
            + COALESCE(c.unload_charges, 0)
            + COALESCE(c.retention_charges, 0)
            + COALESCE(c.extra_km_charges, 0)
            + COALESCE(c.mhc_charges, 0)
            + COALESCE(c.door_coll_charges, 0)
            + COALESCE(c.door_del_charges, 0)
            + COALESCE(c.other_charges, 0)
        END
      , 2)
    ) OVER (PARTITION BY pbr.id) AS cn_total_amount
  FROM public.party_billing_records pbr
  JOIN LATERAL unnest(COALESCE(pbr.covered_cn_nos, ARRAY[]::text[])) WITH ORDINALITY AS cn(cn_no, ord)
    ON true
  LEFT JOIN public.consignments c
    ON c.cn_no = trim(cn.cn_no)
   AND c.billing_party_id = pbr.party_id
   AND c.cancel_cn = false
),
aggregated AS (
  SELECT
    billing_record_id,
    MAX(ROUND(COALESCE(cn_total_amount, 0), 2)) AS cn_total_amount,
    MAX(ROUND(COALESCE(amount, 0) - COALESCE(cn_total_amount, 0), 2)) AS added_other_charges_amount,
    jsonb_agg(
      jsonb_build_object(
        'cn_no', cn_no,
        'bkg_date', bkg_date,
        'invoice_no', invoice_no,
        'vehicle_no', vehicle_no,
        'booking_branch', booking_branch,
        'loading_station', loading_station,
        'delivery_station', delivery_station,
        'charge_wt', charge_wt,
        'freight_rate', freight_rate,
        'freight', freight,
        'unloading', unloading,
        'detention', detention,
        'extra_km', extra_km,
        'loading', loading,
        'door_collection', door_collection,
        'door_delivery', door_delivery,
        'other_charges', ROUND(other_charges + CASE WHEN row_num = row_count THEN ROUND(COALESCE(amount, 0) - COALESCE(cn_total_amount, 0), 2) ELSE 0 END, 2),
        'total_amount', ROUND(total_amount + CASE WHEN row_num = row_count THEN ROUND(COALESCE(amount, 0) - COALESCE(cn_total_amount, 0), 2) ELSE 0 END, 2)
      )
      ORDER BY ord
    ) AS consignment_snapshot
  FROM ordered_consignments
  GROUP BY billing_record_id
)
UPDATE public.party_billing_records pbr
SET
  cn_total_amount = COALESCE(aggregated.cn_total_amount, 0),
  added_other_charges_amount = COALESCE(aggregated.added_other_charges_amount, ROUND(pbr.amount, 2)),
  consignment_snapshot = COALESCE(aggregated.consignment_snapshot, '[]'::jsonb)
FROM aggregated
WHERE pbr.id = aggregated.billing_record_id;

UPDATE public.party_billing_records pbr
SET
  cn_total_amount = 0,
  added_other_charges_amount = ROUND(pbr.amount, 2),
  consignment_snapshot = '[]'::jsonb
WHERE COALESCE(array_length(pbr.covered_cn_nos, 1), 0) = 0;

CREATE OR REPLACE FUNCTION public.fn_validate_billing_record_integrity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  distinct_cn_count integer := 0;
  matched_cn_count integer := 0;
  overlapping_bill_ref text;
  has_active_linked_payment boolean := false;
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

  NEW.cn_total_amount := ROUND(COALESCE(NEW.cn_total_amount, 0), 2);
  NEW.added_other_charges_amount := ROUND(COALESCE(NEW.added_other_charges_amount, 0), 2);
  NEW.amount := ROUND(COALESCE(NEW.amount, 0), 2);

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
  END IF;

  IF ROUND(NEW.cn_total_amount + NEW.added_other_charges_amount, 2) <> NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount must equal cn_total_amount plus added_other_charges_amount.';
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
      OR OLD.consignment_snapshot IS DISTINCT FROM NEW.consignment_snapshot
    ) THEN
      RAISE EXCEPTION 'Bills with active linked payments cannot be edited or cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_billing_record_integrity ON public.party_billing_records;

CREATE TRIGGER trg_validate_billing_record_integrity
  BEFORE INSERT OR UPDATE ON public.party_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_billing_record_integrity();

DROP VIEW IF EXISTS public.vw_party_ledger_summary;

CREATE VIEW public.vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
  p.type                                  AS party_type,
  p.phone,
  p.branch_code,
  p.is_active                             AS party_active,
  pla.id                                  AS ledger_account_id,
  pla.opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,
  COALESCE(cns_agg.total_freight, 0)      AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  COALESCE(cns_agg.total_freight, 0)
    - COALESCE(bill_agg.total_cns_billed, 0) AS unbilled_amount,
  pla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding
FROM public.parties p
JOIN public.party_ledger_accounts pla ON pla.party_id = p.id
LEFT JOIN LATERAL (
  SELECT
    SUM(c.total_freight) AS total_freight,
    COUNT(c.id)          AS cns_count
  FROM public.consignments c
  WHERE c.billing_party_id = p.id
    AND c.cancel_cn = false
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(pbr.amount) AS total_billed,
    SUM(COALESCE(pbr.cn_total_amount, 0)) AS total_cns_billed
  FROM public.party_billing_records pbr
  WHERE pbr.party_id = p.id
    AND pbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(ppr.amount) AS total_paid
  FROM public.party_payment_receipts ppr
  WHERE ppr.party_id = p.id
    AND ppr.status = 'ACTIVE'
) pay_agg ON true
WHERE
  p.is_active = true
  OR pla.opening_balance <> 0
  OR COALESCE(cns_agg.total_freight, 0) <> 0
  OR COALESCE(bill_agg.total_billed, 0) <> 0
  OR COALESCE(pay_agg.total_paid, 0) <> 0;
-- Keep unbilled non-negative and expose overbilled separately in ledger summary

DROP VIEW IF EXISTS public.vw_party_ledger_summary;

CREATE VIEW public.vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
  p.type                                  AS party_type,
  p.phone,
  p.branch_code,
  p.is_active                             AS party_active,
  pla.id                                  AS ledger_account_id,
  pla.opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,
  COALESCE(cns_agg.total_freight, 0)      AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  GREATEST(
    COALESCE(cns_agg.total_freight, 0) - COALESCE(bill_agg.total_cns_billed, 0),
    0
  )                                       AS unbilled_amount,
  GREATEST(
    COALESCE(bill_agg.total_cns_billed, 0) - COALESCE(cns_agg.total_freight, 0),
    0
  )                                       AS overbilled_amount,
  pla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding
FROM public.parties p
JOIN public.party_ledger_accounts pla ON pla.party_id = p.id
LEFT JOIN LATERAL (
  SELECT
    SUM(c.total_freight) AS total_freight,
    COUNT(c.id)          AS cns_count
  FROM public.consignments c
  WHERE c.billing_party_id = p.id
    AND c.cancel_cn = false
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(pbr.amount) AS total_billed,
    SUM(COALESCE(pbr.cn_total_amount, 0)) AS total_cns_billed
  FROM public.party_billing_records pbr
  WHERE pbr.party_id = p.id
    AND pbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(ppr.amount) AS total_paid
  FROM public.party_payment_receipts ppr
  WHERE ppr.party_id = p.id
    AND ppr.status = 'ACTIVE'
) pay_agg ON true
WHERE
  p.is_active = true
  OR pla.opening_balance <> 0
  OR COALESCE(cns_agg.total_freight, 0) <> 0
  OR COALESCE(bill_agg.total_billed, 0) <> 0
  OR COALESCE(pay_agg.total_paid, 0) <> 0;
CREATE TABLE IF NOT EXISTS public.branch_cn_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    next_cn_no BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'inactive')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branch_cn_ranges_bounds_check CHECK (range_start <= range_end),
    CONSTRAINT branch_cn_ranges_next_cn_check CHECK (next_cn_no >= range_start AND next_cn_no <= (range_end + 1))
);

CREATE TABLE IF NOT EXISTS public.branch_cn_reserved_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    reservation_type TEXT NOT NULL DEFAULT 'physical_copy' CHECK (reservation_type = 'physical_copy'),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branch_cn_reserved_ranges_bounds_check CHECK (range_start <= range_end)
);

ALTER TABLE public.branch_cn_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_cn_reserved_ranges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_cn_ranges_no_overlap'
    ) THEN
        ALTER TABLE public.branch_cn_ranges
            ADD CONSTRAINT branch_cn_ranges_no_overlap
            EXCLUDE USING gist (
                int8range(range_start, range_end + 1, '[)') WITH &&
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_cn_reserved_ranges_no_overlap'
    ) THEN
        ALTER TABLE public.branch_cn_reserved_ranges
            ADD CONSTRAINT branch_cn_reserved_ranges_no_overlap
            EXCLUDE USING gist (
                int8range(range_start, range_end + 1, '[)') WITH &&
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_cn_ranges_active_per_branch
    ON public.branch_cn_ranges(branch_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_branch_cn_ranges_branch_id
    ON public.branch_cn_ranges(branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_cn_reserved_ranges_branch_id
    ON public.branch_cn_reserved_ranges(branch_id, created_at DESC);

DROP TRIGGER IF EXISTS set_branch_cn_ranges_updated_at ON public.branch_cn_ranges;
CREATE TRIGGER set_branch_cn_ranges_updated_at
    BEFORE UPDATE ON public.branch_cn_ranges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_branch_cn_reserved_ranges_updated_at ON public.branch_cn_reserved_ranges;
CREATE TRIGGER set_branch_cn_reserved_ranges_updated_at
    BEFORE UPDATE ON public.branch_cn_reserved_ranges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Authenticated users can read branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Authenticated users can read branch CN ranges"
    ON public.branch_cn_ranges
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can insert branch CN ranges"
    ON public.branch_cn_ranges
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can update branch CN ranges"
    ON public.branch_cn_ranges
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can delete branch CN ranges"
    ON public.branch_cn_ranges
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Authenticated users can read branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can insert branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can update branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can delete branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.next_available_branch_cn(
    p_range_id UUID,
    p_candidate BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_range public.branch_cn_ranges;
    v_candidate BIGINT := p_candidate;
    v_reserved RECORD;
BEGIN
    SELECT *
    INTO v_range
    FROM public.branch_cn_ranges
    WHERE id = p_range_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CN range % not found.', p_range_id;
    END IF;

    IF v_candidate < v_range.range_start THEN
        v_candidate := v_range.range_start;
    END IF;

    LOOP
        EXIT WHEN v_candidate > v_range.range_end;

        SELECT range_start, range_end
        INTO v_reserved
        FROM public.branch_cn_reserved_ranges
        WHERE branch_id = v_range.branch_id
          AND range_start <= v_candidate
          AND range_end >= v_candidate
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN v_candidate;
        END IF;

        v_candidate := v_reserved.range_end + 1;
    END LOOP;

    RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_branch_cn_range(
    p_branch_id UUID,
    p_range_start BIGINT,
    p_range_end BIGINT,
    p_note TEXT DEFAULT NULL
)
RETURNS public.branch_cn_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_new_range public.branch_cn_ranges;
    v_normalized_next BIGINT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can manage branch CN ranges.';
    END IF;

    IF p_range_start > p_range_end THEN
        RAISE EXCEPTION 'Range start must be less than or equal to range end.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.branches
        WHERE id = p_branch_id
    ) THEN
        RAISE EXCEPTION 'Branch % not found.', p_branch_id;
    END IF;

    UPDATE public.branch_cn_ranges
    SET status = CASE
        WHEN next_cn_no > range_end THEN 'exhausted'
        ELSE 'inactive'
    END
    WHERE branch_id = p_branch_id
      AND status = 'active';

    INSERT INTO public.branch_cn_ranges (
        branch_id,
        range_start,
        range_end,
        next_cn_no,
        status,
        note
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        p_range_start,
        'active',
        NULLIF(BTRIM(p_note), '')
    )
    RETURNING *
    INTO v_new_range;

    v_normalized_next := public.next_available_branch_cn(v_new_range.id, v_new_range.next_cn_no);

    UPDATE public.branch_cn_ranges
    SET next_cn_no = v_normalized_next,
        status = CASE
            WHEN v_normalized_next > range_end THEN 'exhausted'
            ELSE 'active'
        END
    WHERE id = v_new_range.id
    RETURNING *
    INTO v_new_range;

    UPDATE public.branches
    SET next_cn_no = v_new_range.next_cn_no
    WHERE id = p_branch_id;

    RETURN v_new_range;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'CN range overlaps an existing branch-assigned range.';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_branch_cn_reserved_range(
    p_branch_id UUID,
    p_range_start BIGINT,
    p_range_end BIGINT,
    p_note TEXT DEFAULT NULL
)
RETURNS public.branch_cn_reserved_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reserved public.branch_cn_reserved_ranges;
    v_active_range public.branch_cn_ranges;
    v_normalized_next BIGINT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can manage physical CN reservations.';
    END IF;

    IF p_range_start > p_range_end THEN
        RAISE EXCEPTION 'Range start must be less than or equal to range end.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.branch_cn_ranges
        WHERE branch_id = p_branch_id
          AND p_range_start >= range_start
          AND p_range_end <= range_end
    ) THEN
        RAISE EXCEPTION 'Physical CN range must stay inside an existing CN range assigned to this branch.';
    END IF;

    INSERT INTO public.branch_cn_reserved_ranges (
        branch_id,
        range_start,
        range_end,
        note
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        NULLIF(BTRIM(p_note), '')
    )
    RETURNING *
    INTO v_reserved;

    SELECT *
    INTO v_active_range
    FROM public.branch_cn_ranges
    WHERE branch_id = p_branch_id
      AND status = 'active'
    LIMIT 1;

    IF FOUND THEN
        v_normalized_next := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

        UPDATE public.branch_cn_ranges
        SET next_cn_no = v_normalized_next,
            status = CASE
                WHEN v_normalized_next > range_end THEN 'exhausted'
                ELSE 'active'
            END
        WHERE id = v_active_range.id
        RETURNING *
        INTO v_active_range;

        UPDATE public.branches
        SET next_cn_no = v_active_range.next_cn_no
        WHERE id = p_branch_id;
    END IF;

    RETURN v_reserved;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Physical CN reservation overlaps an existing physical reservation.';
END;
$$;

CREATE OR REPLACE FUNCTION public.advance_branch_cn_sequence(
    p_branch_code TEXT,
    p_cn_no BIGINT
)
RETURNS TABLE (
    consumed_cn_no BIGINT,
    next_cn_no BIGINT,
    range_start BIGINT,
    range_end BIGINT,
    status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_active_range public.branch_cn_ranges;
    v_branch public.branches;
    v_current BIGINT;
    v_next BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    SELECT b.*
    INTO v_branch
    FROM public.branches b
    WHERE UPPER(b.code) = UPPER(BTRIM(p_branch_code))
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Branch % not found.', UPPER(BTRIM(p_branch_code));
    END IF;

    SELECT r.*
    INTO v_active_range
    FROM public.branch_cn_ranges r
    WHERE r.branch_id = v_branch.id
      AND r.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active CN range configured for branch %.', v_branch.code;
    END IF;

    v_current := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

    IF v_current > v_active_range.range_end THEN
        UPDATE public.branch_cn_ranges
        SET next_cn_no = v_current,
            status = 'exhausted'
        WHERE id = v_active_range.id
        RETURNING *
        INTO v_active_range;

        UPDATE public.branches
        SET next_cn_no = v_current
        WHERE id = v_branch.id;

        RAISE EXCEPTION 'CN range %-% is exhausted for branch %.',
            v_active_range.range_start,
            v_active_range.range_end,
            v_branch.code;
    END IF;

    IF p_cn_no <> v_current THEN
        RAISE EXCEPTION 'CN % is not the next available CN for branch %. Expected %.',
            p_cn_no,
            v_branch.code,
            v_current;
    END IF;

    v_next := public.next_available_branch_cn(v_active_range.id, v_current + 1);

    UPDATE public.branch_cn_ranges
    SET next_cn_no = v_next,
        status = CASE
            WHEN v_next > range_end THEN 'exhausted'
            ELSE 'active'
        END
    WHERE id = v_active_range.id
    RETURNING *
    INTO v_active_range;

    UPDATE public.branches
    SET next_cn_no = v_next
    WHERE id = v_branch.id;

    consumed_cn_no := p_cn_no;
    next_cn_no := v_active_range.next_cn_no;
    range_start := v_active_range.range_start;
    range_end := v_active_range.range_end;
    status := v_active_range.status;
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_available_branch_cn(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_branch_cn_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_branch_cn_reserved_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_branch_cn_sequence(TEXT, BIGINT) TO authenticated;
ALTER TABLE challans
DROP CONSTRAINT IF EXISTS challans_challan_type_check;

ALTER TABLE challans
ADD CONSTRAINT challans_challan_type_check
CHECK (challan_type IN ('MAIN', 'INCLUDE', 'FOC'));
ALTER TABLE challans
ADD COLUMN IF NOT EXISTS linked_cn_nos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
-- Create brokers master table
CREATE TABLE IF NOT EXISTS brokers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(20) UNIQUE NOT NULL,
    name TEXT NOT NULL,
    mobile VARCHAR(20),
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast name search (used in auto-fetch)
CREATE INDEX IF NOT EXISTS idx_brokers_name ON brokers USING gin(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_brokers_code ON brokers (code);

-- RLS
ALTER TABLE brokers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read brokers" ON brokers;
CREATE POLICY "Authenticated users can read brokers"
    ON brokers FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can manage brokers" ON brokers;
CREATE POLICY "Admins can manage brokers"
    ON brokers FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );
-- Add loading_point and destination_point to challans table
ALTER TABLE challans
ADD COLUMN IF NOT EXISTS loading_point TEXT,
ADD COLUMN IF NOT EXISTS destination_point TEXT;
-- Add engagement_type to challans table to distinguish Broker vs Direct challans
ALTER TABLE challans
ADD COLUMN IF NOT EXISTS engagement_type TEXT DEFAULT 'broker' CHECK (engagement_type IN ('broker', 'direct'));
-- Create vehicles master table (includes vehicle, owner, insurance, ewaybill, TDS)
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_no VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type TEXT DEFAULT 'open',
    vehicle_make TEXT,
    vehicle_model TEXT,
    engine_no TEXT,
    chasis_no TEXT,
    permit_no TEXT,
    permit_validity DATE,
    tax_token_no TEXT,
    tax_token_validity DATE,
    tax_token_issued_by TEXT,
    -- Owner
    owner_name TEXT,
    owner_mobile VARCHAR(20),
    owner_pan VARCHAR(20),
    owner_address TEXT,
    owner_tel VARCHAR(20),
    -- Insurance
    insurance_policy_no TEXT,
    insurance_validity DATE,
    insurance_company TEXT,
    insurance_city TEXT,
    finance_detail TEXT,
    -- eWaybill
    ewaybill_no TEXT,
    ewaybill_date DATE,
    -- TDS / ITDS
    tds_percent NUMERIC(5,2) DEFAULT 0,
    itds_ref_branch TEXT,
    itds_declare_date DATE,
    itds_financial_year TEXT,
    -- Meta
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_no ON vehicles (vehicle_no);

ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read vehicles" ON vehicles;
CREATE POLICY "Authenticated can read vehicles"
    ON vehicles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can manage vehicles" ON vehicles;
CREATE POLICY "Admins can manage vehicles"
    ON vehicles FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'admin'
        )
    );
-- MASTER RECOVERY SCRIPT: Syncing all missing Challan fields across system
ALTER TABLE challans 
ADD COLUMN IF NOT EXISTS owner_pan VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS owner_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_address TEXT,
ADD COLUMN IF NOT EXISTS owner_tel VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_name TEXT,
ADD COLUMN IF NOT EXISTS broker_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_address TEXT,
ADD COLUMN IF NOT EXISTS slip_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS slip_date DATE,
ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS permit_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS permit_validity DATE,
ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
ADD COLUMN IF NOT EXISTS engine_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS chasis_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_validity DATE,
ADD COLUMN IF NOT EXISTS tax_token_issued_by TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
ADD COLUMN IF NOT EXISTS insurance_policy_no TEXT,
ADD COLUMN IF NOT EXISTS insurance_validity DATE,
ADD COLUMN IF NOT EXISTS insurance_company_name TEXT,
ADD COLUMN IF NOT EXISTS insurance_city TEXT,
ADD COLUMN IF NOT EXISTS finance_detail TEXT,
ADD COLUMN IF NOT EXISTS itds_ref_branch TEXT,
ADD COLUMN IF NOT EXISTS itds_declare_date DATE,
ADD COLUMN IF NOT EXISTS itds_financial_year TEXT,
ADD COLUMN IF NOT EXISTS driver_dl_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_dl_validity DATE,
ADD COLUMN IF NOT EXISTS driver_address TEXT,
ADD COLUMN IF NOT EXISTS loading_point TEXT,
ADD COLUMN IF NOT EXISTS destination_point TEXT,
ADD COLUMN IF NOT EXISTS trip_tracking_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS total_hire_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_hire_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hire_rate_per_kg DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hire_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_weight DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_length DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_height DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_width DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_km_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS detent_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transit_pass_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_extra_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_percent DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS less_tds DECIMAL(10, 2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';
-- Add all challan columns required by the current challan entry form.
-- Safe to run multiple times (IF NOT EXISTS on every column).

ALTER TABLE challans
ADD COLUMN IF NOT EXISTS owner_pan VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_name TEXT,
ADD COLUMN IF NOT EXISTS owner_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS owner_address TEXT,
ADD COLUMN IF NOT EXISTS owner_tel VARCHAR(20),

ADD COLUMN IF NOT EXISTS broker_name TEXT,
ADD COLUMN IF NOT EXISTS broker_code VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_mobile VARCHAR(20),
ADD COLUMN IF NOT EXISTS broker_address TEXT,
ADD COLUMN IF NOT EXISTS slip_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS slip_date DATE,

ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
ADD COLUMN IF NOT EXISTS permit_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS permit_validity DATE,
ADD COLUMN IF NOT EXISTS vehicle_make TEXT,
ADD COLUMN IF NOT EXISTS engine_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS chasis_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS tax_token_validity DATE,
ADD COLUMN IF NOT EXISTS tax_token_issued_by TEXT,
ADD COLUMN IF NOT EXISTS vehicle_model TEXT,

ADD COLUMN IF NOT EXISTS insurance_policy_no TEXT,
ADD COLUMN IF NOT EXISTS insurance_validity DATE,
ADD COLUMN IF NOT EXISTS insurance_company_name TEXT,
ADD COLUMN IF NOT EXISTS insurance_city TEXT,
ADD COLUMN IF NOT EXISTS finance_detail TEXT,

ADD COLUMN IF NOT EXISTS ewaybill_no TEXT,
ADD COLUMN IF NOT EXISTS ewaybill_date DATE,

ADD COLUMN IF NOT EXISTS itds_ref_branch TEXT,
ADD COLUMN IF NOT EXISTS itds_declare_date DATE,
ADD COLUMN IF NOT EXISTS itds_financial_year TEXT,

ADD COLUMN IF NOT EXISTS driver_dl_no VARCHAR(50),
ADD COLUMN IF NOT EXISTS driver_dl_validity DATE,
ADD COLUMN IF NOT EXISTS driver_address TEXT,

ADD COLUMN IF NOT EXISTS loading_point TEXT,
ADD COLUMN IF NOT EXISTS destination_point TEXT,
ADD COLUMN IF NOT EXISTS trip_tracking_consent BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS remarks TEXT,

ADD COLUMN IF NOT EXISTS hire_rate_per_kg DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS hire_amount DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_weight DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_length DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_height DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_over_width DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS extra_km_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS detent_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS transit_pass_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_extra_charges DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tds_percent DECIMAL(5, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS less_tds DECIMAL(10, 2) DEFAULT 0;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
-- Migration: Add unloading_charges field to challans
-- Generated to support dynamic loading and billing tracking

ALTER TABLE public.challans
ADD COLUMN IF NOT EXISTS unloading_charges numeric DEFAULT 0;
-- Migration: Add truck_schedule_date field to challans
-- Stores the date the truck is scheduled to reach the destination

ALTER TABLE public.challans
ADD COLUMN IF NOT EXISTS truck_schedule_date date DEFAULT NULL;
