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
