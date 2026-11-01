-- Party ledger: expose bill extra charges and only flag OB when
-- Billed > CNS Amount + Extra Amount.
--
-- Bill amount = cn_total_amount + added_other_charges_amount + vehicle_cancel_charges_total
-- So Extra = added_other_charges + vehicle_cancel.
--
-- Unbilled  = GREATEST(CNS + Extra − Billed, 0)   -- CN freight still not covered
-- Overbilled = GREATEST(Billed − CNS − Extra, 0)  -- true anomaly only

DROP VIEW IF EXISTS public.vw_party_ledger_summary;

CREATE VIEW public.vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
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
  COALESCE(bill_agg.total_extra_amount, 0) AS total_extra_amount,
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  GREATEST(
    COALESCE(cns_agg.total_freight, 0)
      + COALESCE(bill_agg.total_extra_amount, 0)
      - COALESCE(bill_agg.total_billed, 0),
    0
  )                                       AS unbilled_amount,
  GREATEST(
    COALESCE(bill_agg.total_billed, 0)
      - COALESCE(cns_agg.total_freight, 0)
      - COALESCE(bill_agg.total_extra_amount, 0),
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
    AND c.deleted_at IS NULL
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(pbr.amount) AS total_billed,
    SUM(
      COALESCE(pbr.added_other_charges_amount, 0)
      + COALESCE(pbr.vehicle_cancel_charges_total, 0)
    ) AS total_extra_amount
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

DO $$
BEGIN
  EXECUTE 'ALTER VIEW public.vw_party_ledger_summary SET (security_invoker = true)';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not set security_invoker on vw_party_ledger_summary: %', SQLERRM;
END $$;
