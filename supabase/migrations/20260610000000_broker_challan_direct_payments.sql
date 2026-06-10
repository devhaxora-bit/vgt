-- ============================================================
-- BROKER CHALLAN LEDGER: DIRECT-TO-CHALLAN PAYMENTS
-- Payments are now recorded directly against challan numbers
-- (the intermediate "bill" layer is no longer required).
--
-- A payment receipt may settle one or more challans. Each
-- challan allocation tracks the settled amount (applied to the
-- challan's hire balance), plus optional deduction and addition
-- line items captured at payment time.
--
-- receipt.amount = SUM(settled_amount) across challan allocations
--   (this is what counts as "paid" against challan hire).
-- Deduction / addition line items only affect the displayed net
-- cash figure; they do not change how much hire a challan settles.
-- ============================================================

ALTER TABLE public.broker_challan_payment_receipts
  ADD COLUMN IF NOT EXISTS payer_name TEXT,
  ADD COLUMN IF NOT EXISTS challan_allocations JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.broker_challan_payment_receipts
  DROP CONSTRAINT IF EXISTS bcpr_challan_allocations_is_array_check;

ALTER TABLE public.broker_challan_payment_receipts
  ADD CONSTRAINT bcpr_challan_allocations_is_array_check
  CHECK (jsonb_typeof(challan_allocations) = 'array');

CREATE INDEX IF NOT EXISTS idx_bcpr_challan_allocations_gin
  ON public.broker_challan_payment_receipts USING GIN (challan_allocations);

-- ============================================================
-- Updated summary view: outstanding derives from challan hire
-- (full hire - advance - tds) minus payments, instead of bills.
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
    + GREATEST(
        COALESCE(ch_agg.total_challan_amount, 0)
          - COALESCE(ch_agg.total_advance_amount, 0)
          - COALESCE(ch_agg.total_tds_amount, 0),
        0
      )
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding,
  ch_agg.primary_branch_code,
  COALESCE(ch_agg.total_advance_amount, 0) AS total_advance_amount,
  COALESCE(ch_agg.total_tds_amount, 0)     AS total_tds_amount,
  GREATEST(
    COALESCE(ch_agg.total_challan_amount, 0)
      - COALESCE(ch_agg.total_advance_amount, 0)
      - COALESCE(ch_agg.total_tds_amount, 0),
    0
  )                                       AS net_payable_amount
FROM public.brokers b
JOIN public.broker_ledger_accounts bla ON bla.broker_id = b.id
LEFT JOIN LATERAL (
  SELECT
    SUM(COALESCE(ch.total_hire_amount, 0) + COALESCE(ch.extra_hire_amount, 0)) AS total_challan_amount,
    SUM(COALESCE(ch.advance_amount, 0)) AS total_advance_amount,
    SUM(COALESCE(ch.less_tds, 0)) AS total_tds_amount,
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
