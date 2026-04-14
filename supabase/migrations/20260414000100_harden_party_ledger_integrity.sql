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
