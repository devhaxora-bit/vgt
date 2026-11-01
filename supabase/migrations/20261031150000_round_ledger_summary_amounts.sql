-- Round party ledger summary amounts to whole rupees (half-down style via FLOOR(x+0.5)
-- is NOT used here; we match app rule: ≤.50 down, >.50 up via:
--   CASE WHEN (x*100)::bigint % 100 > 50 THEN ceil ELSE floor END
-- Simpler and consistent with stored money: ROUND to 0 after half-down in app.
-- DB uses: FLOOR(ABS(x) + 0.5) * SIGN for standard half-up is wrong for .50.
-- App rule: rem paise > 50 → up, else down.
-- Equivalent SQL for non-negative amounts: ROUND(x - 0.0000001) almost, but
-- clearest is: FLOOR(x + 0.499999999) which sends .50 down and .51 up.

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
  ROUND(pla.opening_balance - 1e-9)::numeric AS opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,
  ROUND(COALESCE(cns_agg.total_freight, 0) - 1e-9)::numeric AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,
  ROUND(COALESCE(bill_agg.total_extra_amount, 0) - 1e-9)::numeric AS total_extra_amount,
  ROUND(COALESCE(bill_agg.total_billed, 0) - 1e-9)::numeric AS total_billed,
  ROUND(COALESCE(pay_agg.total_paid, 0) - 1e-9)::numeric AS total_paid,
  GREATEST(
    ROUND(
      COALESCE(cns_agg.total_freight, 0)
        + COALESCE(bill_agg.total_extra_amount, 0)
        - COALESCE(bill_agg.total_billed, 0)
      - 1e-9
    )::numeric,
    0
  )                                       AS unbilled_amount,
  GREATEST(
    ROUND(
      COALESCE(bill_agg.total_billed, 0)
        - COALESCE(cns_agg.total_freight, 0)
        - COALESCE(bill_agg.total_extra_amount, 0)
      - 1e-9
    )::numeric,
    0
  )                                       AS overbilled_amount,
  ROUND(
    pla.opening_balance
      + COALESCE(bill_agg.total_billed, 0)
      - COALESCE(pay_agg.total_paid, 0)
    - 1e-9
  )::numeric                              AS outstanding
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
