-- ============================================================
-- PARTY LEDGER SYSTEM SCHEMA
-- ============================================================

-- TABLE 1: party_ledger_accounts
-- One per party. Auto-created by trigger when a party is inserted.
-- ============================================================
CREATE TABLE IF NOT EXISTS party_ledger_accounts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id              UUID NOT NULL UNIQUE REFERENCES parties(id) ON DELETE RESTRICT,

  -- Opening balance set by admin for pre-existing clients
  opening_balance       NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance_date  DATE,
  opening_balance_note  TEXT,

  -- Credit control (display only, no hard block)
  credit_limit          NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit_days           SMALLINT NOT NULL DEFAULT 30,

  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,

  created_by            UUID REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER set_pla_updated_at
  BEFORE UPDATE ON party_ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- Auto-create ledger account when a party is created
CREATE OR REPLACE FUNCTION fn_auto_create_ledger_account()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO party_ledger_accounts (party_id)
  VALUES (NEW.id)
  ON CONFLICT (party_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_auto_create_ledger
  AFTER INSERT ON parties
  FOR EACH ROW EXECUTE FUNCTION fn_auto_create_ledger_account();

-- Backfill for all existing parties
INSERT INTO party_ledger_accounts (party_id)
SELECT id FROM parties
ON CONFLICT (party_id) DO NOTHING;

-- RLS
ALTER TABLE party_ledger_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pla_read_auth" ON party_ledger_accounts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pla_insert_admin" ON party_ledger_accounts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "pla_update_admin" ON party_ledger_accounts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============================================================
-- TABLE 2: party_billing_records
-- Manual billing entries (admin records how much was billed to a party)
-- Full invoice system comes later; this is the manual placeholder.
-- ============================================================
CREATE TABLE IF NOT EXISTS party_billing_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_ledger_account_id UUID NOT NULL REFERENCES party_ledger_accounts(id) ON DELETE RESTRICT,
  party_id                UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,

  billing_date            DATE NOT NULL DEFAULT CURRENT_DATE,
  billing_period_from     DATE,
  billing_period_to       DATE,

  -- Amount is IMMUTABLE after insert (enforced by trigger below)
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),

  -- Optional bill reference number (future invoice number linkage)
  bill_ref_no             VARCHAR(50),

  -- Required description
  narration               TEXT NOT NULL,

  -- CN Nos covered by this bill (comma-separated or array for display)
  covered_cn_nos          TEXT[],

  -- Soft cancellation only — no physical deletes
  status                  TEXT NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'CANCELLED')),
  cancel_reason           TEXT,
  cancelled_at            TIMESTAMPTZ,
  cancelled_by            UUID REFERENCES auth.users(id),

  created_by              UUID NOT NULL REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pbr_party_id     ON party_billing_records(party_id);
CREATE INDEX IF NOT EXISTS idx_pbr_billing_date ON party_billing_records(billing_date DESC);
CREATE INDEX IF NOT EXISTS idx_pbr_status       ON party_billing_records(status);

CREATE TRIGGER set_pbr_updated_at
  BEFORE UPDATE ON party_billing_records
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- IMMUTABILITY TRIGGER: amount and party_id cannot be changed after creation
CREATE OR REPLACE FUNCTION fn_protect_billing_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Billing record amount is immutable. Cancel this record and create a new one instead.';
  END IF;
  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a billing record.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_protect_billing_record
  BEFORE UPDATE ON party_billing_records
  FOR EACH ROW EXECUTE FUNCTION fn_protect_billing_record();

-- RLS
ALTER TABLE party_billing_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pbr_read_auth" ON party_billing_records
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "pbr_insert_admin" ON party_billing_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "pbr_update_admin" ON party_billing_records
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- NO DELETE POLICY — cancellation only via status field

-- ============================================================
-- TABLE 3: party_payment_receipts
-- Records actual money received from a party.
-- ============================================================
CREATE TABLE IF NOT EXISTS party_payment_receipts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_ledger_account_id UUID NOT NULL REFERENCES party_ledger_accounts(id) ON DELETE RESTRICT,
  party_id                UUID NOT NULL REFERENCES parties(id) ON DELETE RESTRICT,

  receipt_date            DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Amount is IMMUTABLE after insert (enforced by trigger below)
  amount                  NUMERIC(14,2) NOT NULL CHECK (amount > 0),

  payment_mode            TEXT NOT NULL DEFAULT 'CASH'
                            CHECK (payment_mode IN ('CASH','CHEQUE','NEFT','RTGS','UPI','ADJUSTMENT')),
  reference_no            VARCHAR(100),  -- UTR / cheque no / UPI ref
  bank_name               TEXT,
  narration               TEXT,

  -- Soft reversal only — no physical deletes
  status                  TEXT NOT NULL DEFAULT 'ACTIVE'
                            CHECK (status IN ('ACTIVE', 'REVERSED')),
  reversal_reason         TEXT,
  reversed_at             TIMESTAMPTZ,
  reversed_by             UUID REFERENCES auth.users(id),

  created_by              UUID NOT NULL REFERENCES auth.users(id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ppr_party_id    ON party_payment_receipts(party_id);
CREATE INDEX IF NOT EXISTS idx_ppr_receipt_date ON party_payment_receipts(receipt_date DESC);

CREATE TRIGGER set_ppr_updated_at
  BEFORE UPDATE ON party_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- IMMUTABILITY TRIGGER: amount and party_id cannot be changed after creation
CREATE OR REPLACE FUNCTION fn_protect_receipt_record()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    RAISE EXCEPTION 'Receipt amount is immutable. Reverse this receipt and create a new one instead.';
  END IF;
  IF OLD.party_id IS DISTINCT FROM NEW.party_id THEN
    RAISE EXCEPTION 'Party cannot be changed on a payment receipt.';
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_protect_receipt_record
  BEFORE UPDATE ON party_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION fn_protect_receipt_record();

-- RLS
ALTER TABLE party_payment_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ppr_read_auth" ON party_payment_receipts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ppr_insert_admin" ON party_payment_receipts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "ppr_update_admin" ON party_payment_receipts
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()));

-- NO DELETE POLICY — reversal only via status field

-- ============================================================
-- ANALYTICS VIEW: vw_party_ledger_summary
-- Used by the /dashboard/ledger overview page.
-- All amounts computed live from source tables — never stored.
-- ============================================================
CREATE OR REPLACE VIEW vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
  p.type                                  AS party_type,
  p.phone,
  p.branch_code,
  pla.id                                  AS ledger_account_id,
  pla.opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,

  -- All CNS total freight for this billing party (every CNS, not cancelled)
  COALESCE(cns_agg.total_freight, 0)      AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,

  -- Billed: sum of ACTIVE billing records
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,

  -- Paid: sum of ACTIVE receipts
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,

  -- Unbilled = Total CNS amount − Total Billed
  COALESCE(cns_agg.total_freight, 0)
    - COALESCE(bill_agg.total_billed, 0)  AS unbilled_amount,

  -- Outstanding = Opening Balance + Total Billed − Total Paid
  pla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding

FROM parties p
JOIN party_ledger_accounts pla ON pla.party_id = p.id
LEFT JOIN LATERAL (
  SELECT
    SUM(c.total_freight)  AS total_freight,
    COUNT(c.id)           AS cns_count
  FROM consignments c
  WHERE c.billing_party_id = p.id
    AND c.cancel_cn = false
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(pbr.amount) AS total_billed
  FROM party_billing_records pbr
  WHERE pbr.party_id = p.id
    AND pbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(ppr.amount) AS total_paid
  FROM party_payment_receipts ppr
  WHERE ppr.party_id = p.id
    AND ppr.status = 'ACTIVE'
) pay_agg ON true
WHERE p.is_active = true;
