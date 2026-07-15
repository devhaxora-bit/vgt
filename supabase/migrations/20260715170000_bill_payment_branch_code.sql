-- ============================================================
-- Stamp branch_code on party/broker bills & payments
-- Backfill from parent party/broker; fallback to head/main branch.
-- branch_code is frozen at create time (immutable).
-- ============================================================

DO $$
DECLARE
  default_branch TEXT;
BEGIN
  SELECT code INTO default_branch
  FROM public.branches
  WHERE is_head_branch = true
  ORDER BY code
  LIMIT 1;

  IF default_branch IS NULL THEN
    SELECT code INTO default_branch
    FROM public.branches
    WHERE UPPER(code) = 'VZM'
    LIMIT 1;
  END IF;

  IF default_branch IS NULL THEN
    SELECT code INTO default_branch
    FROM public.branches
    WHERE COALESCE(is_active, true) = true
    ORDER BY name
    LIMIT 1;
  END IF;

  IF default_branch IS NULL THEN
    RAISE EXCEPTION 'No branches found. Create a branch before applying this migration.';
  END IF;

  -- ---------- PARTY BILLING ----------
  ALTER TABLE public.party_billing_records
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

  UPDATE public.party_billing_records pbr
  SET branch_code = UPPER(BTRIM(p.branch_code))
  FROM public.parties p
  WHERE p.id = pbr.party_id
    AND (pbr.branch_code IS NULL OR BTRIM(pbr.branch_code) = '')
    AND p.branch_code IS NOT NULL
    AND BTRIM(p.branch_code) <> '';

  UPDATE public.party_billing_records
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.party_billing_records ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.party_billing_records
    ALTER COLUMN branch_code SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_billing_records_branch_code_fkey'
  ) THEN
    ALTER TABLE public.party_billing_records
      ADD CONSTRAINT party_billing_records_branch_code_fkey
      FOREIGN KEY (branch_code) REFERENCES public.branches(code)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_pbr_branch_code
    ON public.party_billing_records (branch_code);

  -- ---------- PARTY PAYMENTS ----------
  ALTER TABLE public.party_payment_receipts
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

  UPDATE public.party_payment_receipts ppr
  SET branch_code = UPPER(BTRIM(p.branch_code))
  FROM public.parties p
  WHERE p.id = ppr.party_id
    AND (ppr.branch_code IS NULL OR BTRIM(ppr.branch_code) = '')
    AND p.branch_code IS NOT NULL
    AND BTRIM(p.branch_code) <> '';

  UPDATE public.party_payment_receipts
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.party_payment_receipts ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.party_payment_receipts
    ALTER COLUMN branch_code SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'party_payment_receipts_branch_code_fkey'
  ) THEN
    ALTER TABLE public.party_payment_receipts
      ADD CONSTRAINT party_payment_receipts_branch_code_fkey
      FOREIGN KEY (branch_code) REFERENCES public.branches(code)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_ppr_branch_code
    ON public.party_payment_receipts (branch_code);

  -- ---------- BROKER CHALLAN BILLING ----------
  ALTER TABLE public.broker_challan_billing_records
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

  UPDATE public.broker_challan_billing_records bcbr
  SET branch_code = UPPER(BTRIM(b.branch_code))
  FROM public.brokers b
  WHERE b.id = bcbr.broker_id
    AND (bcbr.branch_code IS NULL OR BTRIM(bcbr.branch_code) = '')
    AND b.branch_code IS NOT NULL
    AND BTRIM(b.branch_code) <> '';

  UPDATE public.broker_challan_billing_records
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.broker_challan_billing_records ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.broker_challan_billing_records
    ALTER COLUMN branch_code SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'broker_challan_billing_records_branch_code_fkey'
  ) THEN
    ALTER TABLE public.broker_challan_billing_records
      ADD CONSTRAINT broker_challan_billing_records_branch_code_fkey
      FOREIGN KEY (branch_code) REFERENCES public.branches(code)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_bcbr_branch_code
    ON public.broker_challan_billing_records (branch_code);

  -- ---------- BROKER CHALLAN PAYMENTS ----------
  ALTER TABLE public.broker_challan_payment_receipts
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(20);

  UPDATE public.broker_challan_payment_receipts bcpr
  SET branch_code = UPPER(BTRIM(b.branch_code))
  FROM public.brokers b
  WHERE b.id = bcpr.broker_id
    AND (bcpr.branch_code IS NULL OR BTRIM(bcpr.branch_code) = '')
    AND b.branch_code IS NOT NULL
    AND BTRIM(b.branch_code) <> '';

  UPDATE public.broker_challan_payment_receipts
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.broker_challan_payment_receipts ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.broker_challan_payment_receipts
    ALTER COLUMN branch_code SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'broker_challan_payment_receipts_branch_code_fkey'
  ) THEN
    ALTER TABLE public.broker_challan_payment_receipts
      ADD CONSTRAINT broker_challan_payment_receipts_branch_code_fkey
      FOREIGN KEY (branch_code) REFERENCES public.branches(code)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_bcpr_branch_code
    ON public.broker_challan_payment_receipts (branch_code);

  COMMENT ON COLUMN public.party_billing_records.branch_code IS
    'Branch owning this bill at create time (frozen). Backfilled from party.branch_code.';
  COMMENT ON COLUMN public.party_payment_receipts.branch_code IS
    'Branch owning this payment at create time (frozen). Backfilled from party.branch_code.';
  COMMENT ON COLUMN public.broker_challan_billing_records.branch_code IS
    'Branch owning this challan bill at create time (frozen). Backfilled from broker.branch_code.';
  COMMENT ON COLUMN public.broker_challan_payment_receipts.branch_code IS
    'Branch owning this challan payment at create time (frozen). Backfilled from broker.branch_code.';
END $$;

-- Freeze branch_code on party billing updates
CREATE OR REPLACE FUNCTION public.fn_protect_billing_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount is immutable. Cancel this record and create a new one instead.';
  END IF;
  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a billing record.';
  END IF;
  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a billing record.';
  END IF;
  RETURN NEW;
END; $$;

-- Freeze branch_code on party payment updates
CREATE OR REPLACE FUNCTION public.fn_protect_receipt_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Receipt amount is immutable. Reverse this receipt and create a new one instead.';
  END IF;
  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a payment receipt.';
  END IF;
  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a payment receipt.';
  END IF;
  RETURN NEW;
END; $$;

-- Broker-side protect functions (create or replace if they already exist for other fields)
CREATE OR REPLACE FUNCTION public.fn_protect_broker_challan_billing_branch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
    RAISE EXCEPTION 'Broker cannot be changed on a challan billing record.';
  END IF;
  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a challan billing record.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_broker_challan_billing_branch ON public.broker_challan_billing_records;
CREATE TRIGGER trg_protect_broker_challan_billing_branch
  BEFORE UPDATE ON public.broker_challan_billing_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_broker_challan_billing_branch();

CREATE OR REPLACE FUNCTION public.fn_protect_broker_challan_payment_branch()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.broker_id IS DISTINCT FROM NEW.broker_id THEN
    RAISE EXCEPTION 'Broker cannot be changed on a challan payment receipt.';
  END IF;
  IF OLD.branch_code IS DISTINCT FROM NEW.branch_code THEN
    RAISE EXCEPTION 'Branch cannot be changed on a challan payment receipt.';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_broker_challan_payment_branch ON public.broker_challan_payment_receipts;
CREATE TRIGGER trg_protect_broker_challan_payment_branch
  BEFORE UPDATE ON public.broker_challan_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_protect_broker_challan_payment_branch();
