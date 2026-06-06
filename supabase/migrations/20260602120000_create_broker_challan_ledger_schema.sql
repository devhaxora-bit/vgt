-- ============================================================
-- BROKER CHALLAN LEDGER SYSTEM
-- Mirrors party ledger for loading challans per broker
-- ============================================================

-- Link challans to brokers master
ALTER TABLE public.challans
  ADD COLUMN IF NOT EXISTS broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL;

UPDATE public.challans c
SET broker_id = b.id
FROM public.brokers b
WHERE UPPER(TRIM(c.broker_code)) = UPPER(TRIM(b.code))
  AND c.broker_id IS NULL
  AND COALESCE(c.engagement_type, 'broker') = 'broker';

CREATE INDEX IF NOT EXISTS idx_challans_broker_id
  ON public.challans(broker_id);

CREATE INDEX IF NOT EXISTS idx_challans_broker_date
  ON public.challans(broker_id, date_from DESC);

-- ============================================================
-- TABLE: broker_ledger_accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broker_ledger_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_id             UUID NOT NULL UNIQUE REFERENCES public.brokers(id) ON DELETE RESTRICT,

  opening_balance       NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance_date  DATE,
  opening_balance_note  TEXT,

  credit_limit          NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_days           SMALLINT NOT NULL DEFAULT 30,

  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,

  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_bla_updated_at
  BEFORE UPDATE ON public.broker_ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE OR REPLACE FUNCTION public.fn_auto_create_broker_ledger_account()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.broker_ledger_accounts (broker_id)
  VALUES (NEW.id)
  ON CONFLICT (broker_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_auto_create_broker_ledger ON public.brokers;
CREATE TRIGGER trg_auto_create_broker_ledger
  AFTER INSERT ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_create_broker_ledger_account();

INSERT INTO public.broker_ledger_accounts (broker_id)
SELECT id FROM public.brokers
ON CONFLICT (broker_id) DO NOTHING;

ALTER TABLE public.broker_ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bla_read_auth" ON public.broker_ledger_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bla_insert_admin" ON public.broker_ledger_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "bla_update_admin" ON public.broker_ledger_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.broker_ledger_accounts
  ADD CONSTRAINT broker_ledger_accounts_id_broker_id_key UNIQUE (id, broker_id);

-- ============================================================
-- TABLE: broker_challan_billing_records
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broker_challan_billing_records (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_ledger_account_id    UUID NOT NULL REFERENCES public.broker_ledger_accounts(id) ON DELETE RESTRICT,
  broker_id                   UUID NOT NULL REFERENCES public.brokers(id) ON DELETE RESTRICT,

  billing_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  billing_period_from         DATE,
  billing_period_to           DATE,

  amount                      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  bill_ref_no                 VARCHAR(50),
  narration                   TEXT NOT NULL,

  covered_challan_nos         TEXT[],
  challan_total_amount        NUMERIC(14,2) NOT NULL DEFAULT 0,
  added_other_charges_amount  NUMERIC(14,2) NOT NULL DEFAULT 0,
  challan_snapshot            JSONB NOT NULL DEFAULT '[]'::jsonb,
  extra_charge_items          JSONB NOT NULL DEFAULT '[]'::jsonb,

  status                      TEXT NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE', 'CANCELLED')),
  cancel_reason               TEXT,
  cancelled_at                TIMESTAMPTZ,
  cancelled_by                UUID REFERENCES auth.users(id),

  created_by                  UUID NOT NULL REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bcbr_challan_snapshot_is_array_check
    CHECK (jsonb_typeof(challan_snapshot) = 'array'),
  CONSTRAINT bcbr_extra_charge_items_is_array_check
    CHECK (jsonb_typeof(extra_charge_items) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_bcbr_broker_id ON public.broker_challan_billing_records(broker_id);
CREATE INDEX IF NOT EXISTS idx_bcbr_billing_date ON public.broker_challan_billing_records(billing_date DESC);
CREATE INDEX IF NOT EXISTS idx_bcbr_status ON public.broker_challan_billing_records(status);
CREATE INDEX IF NOT EXISTS idx_bcbr_covered_challan_nos_gin
  ON public.broker_challan_billing_records USING GIN (covered_challan_nos);

CREATE TRIGGER set_bcbr_updated_at
  BEFORE UPDATE ON public.broker_challan_billing_records
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.broker_challan_billing_records
  ADD CONSTRAINT bcbr_broker_account_match_fk
  FOREIGN KEY (broker_ledger_account_id, broker_id)
  REFERENCES public.broker_ledger_accounts (id, broker_id);

ALTER TABLE public.broker_challan_billing_records
  ADD CONSTRAINT bcbr_cancel_audit_check
  CHECK (
    (status = 'ACTIVE' AND cancel_reason IS NULL AND cancelled_at IS NULL AND cancelled_by IS NULL)
    OR
    (status = 'CANCELLED' AND cancel_reason IS NOT NULL AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
  );

ALTER TABLE public.broker_challan_billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bcbr_read_auth" ON public.broker_challan_billing_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bcbr_insert_admin" ON public.broker_challan_billing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "bcbr_update_admin" ON public.broker_challan_billing_records
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- TABLE: broker_challan_payment_receipts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.broker_challan_payment_receipts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broker_ledger_account_id    UUID NOT NULL REFERENCES public.broker_ledger_accounts(id) ON DELETE RESTRICT,
  broker_id                   UUID NOT NULL REFERENCES public.brokers(id) ON DELETE RESTRICT,

  receipt_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  amount                      NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  actual_received_amount      NUMERIC(14,2) NOT NULL,

  payment_mode                TEXT NOT NULL DEFAULT 'CASH'
                                CHECK (payment_mode IN ('CASH','CHEQUE','NEFT','RTGS','UPI','ADJUSTMENT')),
  reference_no                VARCHAR(100),
  bank_name                   TEXT,
  narration                   TEXT,

  related_billing_record_ids  UUID[] NOT NULL DEFAULT ARRAY[]::uuid[],
  bill_allocations            JSONB NOT NULL DEFAULT '[]'::jsonb,

  status                      TEXT NOT NULL DEFAULT 'ACTIVE'
                                CHECK (status IN ('ACTIVE', 'REVERSED')),
  reversal_reason             TEXT,
  reversed_at                 TIMESTAMPTZ,
  reversed_by                 UUID REFERENCES auth.users(id),

  created_by                  UUID NOT NULL REFERENCES auth.users(id),
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bcpr_actual_received_amount_check
    CHECK (actual_received_amount >= 0 AND actual_received_amount <= amount),
  CONSTRAINT bcpr_bill_allocations_is_array_check
    CHECK (jsonb_typeof(bill_allocations) = 'array')
);

CREATE INDEX IF NOT EXISTS idx_bcpr_broker_id ON public.broker_challan_payment_receipts(broker_id);
CREATE INDEX IF NOT EXISTS idx_bcpr_receipt_date ON public.broker_challan_payment_receipts(receipt_date DESC);

CREATE TRIGGER set_bcpr_updated_at
  BEFORE UPDATE ON public.broker_challan_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.broker_challan_payment_receipts
  ADD CONSTRAINT bcpr_broker_account_match_fk
  FOREIGN KEY (broker_ledger_account_id, broker_id)
  REFERENCES public.broker_ledger_accounts (id, broker_id);

ALTER TABLE public.broker_challan_payment_receipts
  ADD CONSTRAINT bcpr_reversal_audit_check
  CHECK (
    (status = 'ACTIVE' AND reversal_reason IS NULL AND reversed_at IS NULL AND reversed_by IS NULL)
    OR
    (status = 'REVERSED' AND reversal_reason IS NOT NULL AND reversed_at IS NOT NULL AND reversed_by IS NOT NULL)
  );

ALTER TABLE public.broker_challan_payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bcpr_read_auth" ON public.broker_challan_payment_receipts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "bcpr_insert_admin" ON public.broker_challan_payment_receipts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "bcpr_update_admin" ON public.broker_challan_payment_receipts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- Billing integrity trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_validate_broker_challan_billing_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  distinct_challan_count integer := 0;
  matched_challan_count integer := 0;
  overlapping_bill_ref text;
  has_active_linked_payment boolean := false;
BEGIN
  IF NEW.covered_challan_nos IS NOT NULL THEN
    NEW.covered_challan_nos := ARRAY(
      SELECT trimmed_no
      FROM (
        SELECT trim(challan_no) AS trimmed_no, ord
        FROM unnest(NEW.covered_challan_nos) WITH ORDINALITY AS input(challan_no, ord)
        WHERE trim(challan_no) <> ''
      ) normalized
      ORDER BY ord
    );

    IF cardinality(NEW.covered_challan_nos) = 0 THEN
      NEW.covered_challan_nos := NULL;
    END IF;
  END IF;

  IF NEW.challan_snapshot IS NULL THEN
    NEW.challan_snapshot := '[]'::jsonb;
  END IF;

  IF jsonb_typeof(NEW.challan_snapshot) <> 'array' THEN
    RAISE EXCEPTION 'challan_snapshot must be a JSON array.';
  END IF;

  IF NEW.extra_charge_items IS NULL THEN
    NEW.extra_charge_items := '[]'::jsonb;
  END IF;

  NEW.challan_total_amount := ROUND(COALESCE(NEW.challan_total_amount, 0), 2);
  NEW.added_other_charges_amount := ROUND(COALESCE(NEW.added_other_charges_amount, 0), 2);
  NEW.amount := ROUND(COALESCE(NEW.amount, 0), 2);

  IF NEW.amount <= 0 THEN
    RAISE EXCEPTION 'Billing record amount must be greater than zero.';
  END IF;

  IF ROUND(NEW.challan_total_amount + NEW.added_other_charges_amount, 2) <> NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount must equal challan_total_amount plus added_other_charges_amount.';
  END IF;

  IF NEW.covered_challan_nos IS NULL OR cardinality(NEW.covered_challan_nos) = 0 THEN
    IF NEW.challan_total_amount <> 0 THEN
      RAISE EXCEPTION 'challan_total_amount must be zero when no covered challans are linked.';
    END IF;

    IF jsonb_array_length(NEW.challan_snapshot) <> 0 THEN
      RAISE EXCEPTION 'challan_snapshot must be empty when no covered challans are linked.';
    END IF;
  ELSE
    SELECT COUNT(*) INTO distinct_challan_count
    FROM (
      SELECT DISTINCT challan_no
      FROM unnest(NEW.covered_challan_nos) AS challan_no
    ) unique_challans;

    IF distinct_challan_count <> cardinality(NEW.covered_challan_nos) THEN
      RAISE EXCEPTION 'covered_challan_nos must not contain duplicates.';
    END IF;

    SELECT COUNT(*) INTO matched_challan_count
    FROM (
      SELECT DISTINCT ch.challan_no
      FROM public.challans ch
      WHERE ch.broker_id = NEW.broker_id
        AND ch.status = 'ACTIVE'
        AND ch.challan_no = ANY(NEW.covered_challan_nos)
    ) matched_challans;

    IF matched_challan_count <> distinct_challan_count THEN
      RAISE EXCEPTION 'Every covered challan must belong to the same broker and remain active.';
    END IF;

    IF jsonb_array_length(NEW.challan_snapshot) <> cardinality(NEW.covered_challan_nos) THEN
      RAISE EXCEPTION 'challan_snapshot must include one row per covered challan.';
    END IF;

    IF NEW.status = 'ACTIVE' THEN
      SELECT COALESCE(bcbr.bill_ref_no, bcbr.id::text)
      INTO overlapping_bill_ref
      FROM public.broker_challan_billing_records bcbr
      WHERE bcbr.broker_id = NEW.broker_id
        AND bcbr.status = 'ACTIVE'
        AND bcbr.id IS DISTINCT FROM NEW.id
        AND bcbr.covered_challan_nos && NEW.covered_challan_nos
      LIMIT 1;

      IF overlapping_bill_ref IS NOT NULL THEN
        RAISE EXCEPTION 'Covered challans are already billed on active bill %.', overlapping_bill_ref;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.broker_challan_payment_receipts bcpr
      WHERE bcpr.broker_id = OLD.broker_id
        AND bcpr.status = 'ACTIVE'
        AND (
          bcpr.related_billing_record_ids @> ARRAY[OLD.id]::uuid[]
          OR EXISTS (
            SELECT 1
            FROM jsonb_array_elements(COALESCE(bcpr.bill_allocations, '[]'::jsonb)) AS allocation
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
      OR OLD.covered_challan_nos IS DISTINCT FROM NEW.covered_challan_nos
      OR OLD.status IS DISTINCT FROM NEW.status
      OR OLD.challan_total_amount IS DISTINCT FROM NEW.challan_total_amount
      OR OLD.added_other_charges_amount IS DISTINCT FROM NEW.added_other_charges_amount
      OR OLD.challan_snapshot IS DISTINCT FROM NEW.challan_snapshot
      OR OLD.extra_charge_items IS DISTINCT FROM NEW.extra_charge_items
    ) THEN
      RAISE EXCEPTION 'Bills with active linked payments cannot be edited or cancelled.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_broker_challan_billing_record ON public.broker_challan_billing_records;
CREATE TRIGGER trg_validate_broker_challan_billing_record
  BEFORE INSERT OR UPDATE ON public.broker_challan_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_broker_challan_billing_record();

CREATE OR REPLACE FUNCTION public.fn_protect_broker_challan_billing_record()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
    RAISE EXCEPTION 'Broker cannot be changed on a billing record.';
  END IF;

  IF OLD.broker_ledger_account_id IS DISTINCT FROM NEW.broker_ledger_account_id THEN
    RAISE EXCEPTION 'Ledger account cannot be changed on a billing record.';
  END IF;

  IF OLD.status = 'CANCELLED' AND NEW.status IS DISTINCT FROM 'CANCELLED' THEN
    RAISE EXCEPTION 'Cancelled billing records cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_broker_challan_billing_record ON public.broker_challan_billing_records;
CREATE TRIGGER trg_protect_broker_challan_billing_record
  BEFORE UPDATE ON public.broker_challan_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_broker_challan_billing_record();

-- ============================================================
-- Payment validation trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_validate_broker_challan_payment_links()
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
  LEFT JOIN public.broker_challan_billing_records bcbr
    ON bcbr.id = bill_id
  WHERE bcbr.id IS NULL
    OR bcbr.broker_id IS DISTINCT FROM NEW.broker_id;

  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'All related billing records must belong to the same broker as the payment receipt.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_broker_challan_payment_links ON public.broker_challan_payment_receipts;
CREATE TRIGGER trg_validate_broker_challan_payment_links
  BEFORE INSERT OR UPDATE ON public.broker_challan_payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_broker_challan_payment_links();

CREATE OR REPLACE FUNCTION public.fn_protect_broker_challan_receipt_record()
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

  IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
    RAISE EXCEPTION 'Broker cannot be changed on a payment receipt.';
  END IF;

  IF OLD.broker_ledger_account_id IS DISTINCT FROM NEW.broker_ledger_account_id THEN
    RAISE EXCEPTION 'Ledger account cannot be changed on a payment receipt.';
  END IF;

  IF OLD.status = 'REVERSED' AND NEW.status IS DISTINCT FROM 'REVERSED' THEN
    RAISE EXCEPTION 'Reversed payment receipts cannot be reactivated.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_broker_challan_receipt_record ON public.broker_challan_payment_receipts;
CREATE TRIGGER trg_protect_broker_challan_receipt_record
  BEFORE UPDATE ON public.broker_challan_payment_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_protect_broker_challan_receipt_record();

-- ============================================================
-- Analytics view
-- ============================================================
CREATE OR REPLACE VIEW public.vw_broker_challan_ledger_summary AS
SELECT
  b.id                                    AS broker_id,
  b.code                                  AS broker_code,
  b.name                                  AS broker_name,
  b.mobile                                AS broker_mobile,
  b.is_active                             AS broker_active,
  bla.id                                  AS ledger_account_id,
  bla.opening_balance,
  bla.credit_limit,
  bla.credit_days,
  bla.is_active                           AS ledger_active,
  COALESCE(ch_agg.total_challan_amount, 0) AS total_challan_amount,
  COALESCE(ch_agg.total_challan_count, 0)  AS total_challan_count,
  COALESCE(bill_agg.total_billed, 0)         AS total_billed,
  COALESCE(pay_agg.total_paid, 0)            AS total_paid,
  GREATEST(
    COALESCE(ch_agg.total_challan_amount, 0) - COALESCE(bill_agg.total_billed, 0),
    0
  )                                       AS unbilled_amount,
  GREATEST(
    COALESCE(bill_agg.total_billed, 0) - COALESCE(ch_agg.total_challan_amount, 0),
    0
  )                                       AS overbilled_amount,
  bla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding,
  ch_agg.primary_branch_code
FROM public.brokers b
JOIN public.broker_ledger_accounts bla ON bla.broker_id = b.id
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(ch.total_hire_amount, 0) + COALESCE(ch.extra_hire_amount, 0)) AS total_challan_amount,
    COUNT(ch.id) AS total_challan_count,
    (
      SELECT ch2.origin_branch_code
      FROM public.challans ch2
      WHERE ch2.broker_id = b.id
        AND ch2.status = 'ACTIVE'
      ORDER BY ch2.date_from DESC NULLS LAST, ch2.created_at DESC
      LIMIT 1
    ) AS primary_branch_code
  FROM public.challans ch
  WHERE ch.broker_id = b.id
    AND ch.status = 'ACTIVE'
    AND COALESCE(ch.engagement_type, 'broker') = 'broker'
) ch_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(bcbr.amount) AS total_billed
  FROM public.broker_challan_billing_records bcbr
  WHERE bcbr.broker_id = b.id
    AND bcbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(bcpr.amount) AS total_paid
  FROM public.broker_challan_payment_receipts bcpr
  WHERE bcpr.broker_id = b.id
    AND bcpr.status = 'ACTIVE'
) pay_agg ON true
WHERE
  b.is_active = true
  OR bla.opening_balance <> 0
  OR COALESCE(ch_agg.total_challan_amount, 0) <> 0
  OR COALESCE(bill_agg.total_billed, 0) <> 0
  OR COALESCE(pay_agg.total_paid, 0) <> 0;

NOTIFY pgrst, 'reload schema';
