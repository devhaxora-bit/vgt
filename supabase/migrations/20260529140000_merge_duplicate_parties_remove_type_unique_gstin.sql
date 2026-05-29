-- ============================================================
-- MIGRATION: Merge duplicate parties by GSTIN, remove party type,
--            add unique constraint on GSTIN
-- ============================================================
-- PRODUCTION SAFE: Run each section one at a time in order.
-- ============================================================


-- ============================================================
-- SECTION 1: MERGE DUPLICATES (only if duplicates exist)
-- Run this section. It will do nothing if no duplicates found.
-- ============================================================

DO $$
DECLARE
  _dup_count INT;
BEGIN
  -- Check for duplicates
  SELECT COUNT(*) INTO _dup_count
  FROM (
    SELECT UPPER(TRIM(gstin)) AS normalized_gstin
    FROM parties
    WHERE gstin IS NOT NULL
      AND TRIM(gstin) <> ''
      AND is_active = true
    GROUP BY UPPER(TRIM(gstin))
    HAVING COUNT(*) > 1
  ) dups;

  IF _dup_count = 0 THEN
    RAISE NOTICE 'No duplicate GSTINs found. Skipping merge.';
  ELSE
    RAISE NOTICE 'Found % duplicate GSTIN groups. Starting merge...', _dup_count;

    -- Create staging tables
    DROP TABLE IF EXISTS public._migration_winner_ledger;
    DROP TABLE IF EXISTS public._migration_party_merge_map;

    CREATE TABLE public._migration_party_merge_map AS
    WITH ranked AS (
      SELECT
        id,
        gstin,
        code,
        ROW_NUMBER() OVER (
          PARTITION BY UPPER(TRIM(gstin))
          ORDER BY code ASC, created_at ASC
        ) AS rn
      FROM parties
      WHERE gstin IS NOT NULL
        AND TRIM(gstin) <> ''
        AND is_active = true
    )
    SELECT
      loser.id   AS loser_id,
      winner.id  AS winner_id,
      loser.gstin
    FROM ranked loser
    JOIN ranked winner
      ON UPPER(TRIM(winner.gstin)) = UPPER(TRIM(loser.gstin))
      AND winner.rn = 1
    WHERE loser.rn > 1;

    -- Reassign consignments
    UPDATE consignments c
    SET billing_party_id = m.winner_id,
        billing_party_code = wp.code
    FROM public._migration_party_merge_map m
    JOIN parties wp ON wp.id = m.winner_id
    WHERE c.billing_party_id = m.loser_id;

    -- Ensure winner has ledger account
    INSERT INTO party_ledger_accounts (party_id)
    SELECT DISTINCT winner_id FROM public._migration_party_merge_map
    ON CONFLICT (party_id) DO NOTHING;

    -- Merge opening balances
    UPDATE party_ledger_accounts pla
    SET opening_balance = pla.opening_balance + loser_bal.total_opening
    FROM (
      SELECT m.winner_id, SUM(la.opening_balance) AS total_opening
      FROM public._migration_party_merge_map m
      JOIN party_ledger_accounts la ON la.party_id = m.loser_id
      GROUP BY m.winner_id
    ) loser_bal
    WHERE pla.party_id = loser_bal.winner_id;

    -- Create winner ledger lookup
    CREATE TABLE public._migration_winner_ledger AS
    SELECT pla.id AS ledger_account_id, pla.party_id
    FROM party_ledger_accounts pla
    WHERE pla.party_id IN (SELECT DISTINCT winner_id FROM public._migration_party_merge_map);

    -- Disable triggers
    ALTER TABLE party_billing_records DISABLE TRIGGER trg_protect_billing_record;
    ALTER TABLE party_payment_receipts DISABLE TRIGGER trg_protect_receipt_record;

    -- Drop FK constraints
    ALTER TABLE party_billing_records DROP CONSTRAINT IF EXISTS pbr_party_account_match_fk;
    ALTER TABLE party_payment_receipts DROP CONSTRAINT IF EXISTS ppr_party_account_match_fk;

    -- Reassign billing records
    UPDATE party_billing_records pbr
    SET party_id = m.winner_id,
        party_ledger_account_id = wl.ledger_account_id
    FROM public._migration_party_merge_map m
    JOIN public._migration_winner_ledger wl ON wl.party_id = m.winner_id
    WHERE pbr.party_id = m.loser_id;

    -- Reassign payment receipts
    UPDATE party_payment_receipts ppr
    SET party_id = m.winner_id,
        party_ledger_account_id = wl.ledger_account_id
    FROM public._migration_party_merge_map m
    JOIN public._migration_winner_ledger wl ON wl.party_id = m.winner_id
    WHERE ppr.party_id = m.loser_id;

    -- Re-enable triggers
    ALTER TABLE party_billing_records ENABLE TRIGGER trg_protect_billing_record;
    ALTER TABLE party_payment_receipts ENABLE TRIGGER trg_protect_receipt_record;

    -- Recreate FK constraints
    ALTER TABLE party_billing_records
      ADD CONSTRAINT pbr_party_account_match_fk
      FOREIGN KEY (party_ledger_account_id, party_id)
      REFERENCES party_ledger_accounts (id, party_id);

    ALTER TABLE party_payment_receipts
      ADD CONSTRAINT ppr_party_account_match_fk
      FOREIGN KEY (party_ledger_account_id, party_id)
      REFERENCES party_ledger_accounts (id, party_id);

    -- Soft-delete loser parties
    UPDATE parties
    SET is_active = false, updated_at = NOW()
    WHERE id IN (SELECT loser_id FROM public._migration_party_merge_map);

    -- Deactivate loser ledger accounts
    UPDATE party_ledger_accounts
    SET is_active = false, opening_balance = 0, updated_at = NOW()
    WHERE party_id IN (SELECT loser_id FROM public._migration_party_merge_map);

    -- Cleanup
    DROP TABLE IF EXISTS public._migration_winner_ledger;
    DROP TABLE IF EXISTS public._migration_party_merge_map;

    RAISE NOTICE 'Merge complete.';
  END IF;
END $$;


-- ============================================================
-- SECTION 2: DROP VIEW AND TYPE COLUMN
-- Run this after Section 1.
-- ============================================================

DROP VIEW IF EXISTS public.vw_party_ledger_summary;
DROP INDEX IF EXISTS idx_parties_type;

DO $$
DECLARE
  _conname TEXT;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'parties'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%type%';
  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE parties DROP CONSTRAINT %I', _conname);
    RAISE NOTICE 'Dropped constraint: %', _conname;
  ELSE
    RAISE NOTICE 'No type constraint found (already dropped or never existed).';
  END IF;
END $$;

ALTER TABLE parties DROP COLUMN IF EXISTS type;


-- ============================================================
-- SECTION 3: RECREATE VIEW AND ADD GSTIN UNIQUE INDEX
-- Run this after Section 2.
-- ============================================================

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
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  GREATEST(
    COALESCE(cns_agg.total_freight, 0) - COALESCE(bill_agg.total_billed, 0),
    0
  )                                       AS unbilled_amount,
  GREATEST(
    COALESCE(bill_agg.total_billed, 0) - COALESCE(cns_agg.total_freight, 0),
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_parties_gstin_unique
  ON parties (UPPER(TRIM(gstin)))
  WHERE gstin IS NOT NULL
    AND TRIM(gstin) <> ''
    AND is_active = true;


-- ============================================================
-- DONE! Verify with:
-- ============================================================
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'parties';
-- SELECT * FROM vw_party_ledger_summary LIMIT 5;
