-- Fix unbilled_amount to use total_billed (invoice amount) instead of total_cns_billed (CN portion only).
--
-- Previously:
--   unbilled_amount = GREATEST(total_cns_amount - total_cns_billed, 0)
--   where total_cns_billed = SUM(cn_total_amount) -- just the CN freight covered by bills
--
-- This caused the top summary boxes to be mathematically inconsistent:
--   total_billed (invoice) + unbilled_amount > total_cns_amount  (when bills include extra charges)
--
-- With this fix:
--   unbilled_amount = GREATEST(total_cns_amount - total_billed, 0)  (invoice amount basis)
--   overbilled_amount = GREATEST(total_billed - total_cns_amount, 0)
--
-- Now: total_billed + unbilled_amount = total_cns_amount + overbilled_amount
-- When no overbilling: total_billed + unbilled_amount = total_cns_amount  (additive)

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
  -- Unbilled = CNS freight minus what has been invoiced (clamped ≥ 0)
  GREATEST(
    COALESCE(cns_agg.total_freight, 0) - COALESCE(bill_agg.total_billed, 0),
    0
  )                                       AS unbilled_amount,
  -- Overbilled = invoice amount exceeds CNS freight (e.g. bills with large extra charges)
  GREATEST(
    COALESCE(bill_agg.total_billed, 0) - COALESCE(cns_agg.total_freight, 0),
    0
  )                                       AS overbilled_amount,
  -- Outstanding = Opening Balance + Total Billed − Total Paid
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
    SUM(pbr.amount) AS total_billed
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
