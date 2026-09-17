-- ============================================================
-- DB-level UNIQUE constraint for bill_ref_no
--
-- Before this migration the application checked uniqueness via
-- findDuplicateGlobalBillRefNo (app layer only). A race between
-- two concurrent admin requests could bypass that check. This
-- migration:
--   1) auto-renames existing duplicates (keeps one canonical row)
--   2) adds UNIQUE indexes per billing table
--   3) adds a SECURITY DEFINER trigger for cross-table collisions
--
-- Canonical row per duplicate group (kept as-is):
--   ACTIVE first, then earliest created_at, then id.
-- Extra rows become:  {original}-D{6 hex from id}
-- e.g. VZM/26-27/1892  →  VZM/26-27/1892-Da1b2c3
-- ============================================================

-- Preview duplicates (optional; for operators):
-- SELECT UPPER(TRIM(bill_ref_no)) AS ref_key, COUNT(*) AS n,
--        array_agg(bill_ref_no ORDER BY created_at) AS refs
-- FROM public.party_billing_records
-- WHERE bill_ref_no IS NOT NULL
-- GROUP BY UPPER(TRIM(bill_ref_no))
-- HAVING COUNT(*) > 1;

-- 1) Auto-resolve duplicates inside party_billing_records
DO $$
DECLARE
  renamed_count integer := 0;
BEGIN
  -- Integrity trigger blocks bill_ref_no edits when payments are linked
  ALTER TABLE public.party_billing_records
    DISABLE TRIGGER trg_validate_billing_record_integrity;
  ALTER TABLE public.party_billing_records
    DISABLE TRIGGER trg_protect_billing_record;

  WITH ranked AS (
    SELECT
      id,
      bill_ref_no,
      ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(bill_ref_no))
        ORDER BY
          CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
          created_at ASC NULLS LAST,
          id ASC
      ) AS rn
    FROM public.party_billing_records
    WHERE bill_ref_no IS NOT NULL
      AND TRIM(bill_ref_no) <> ''
  ),
  to_rename AS (
    SELECT
      id,
      TRIM(bill_ref_no) || '-D' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 6) AS new_ref
    FROM ranked
    WHERE rn > 1
  )
  UPDATE public.party_billing_records pbr
  SET bill_ref_no = tr.new_ref
  FROM to_rename tr
  WHERE pbr.id = tr.id;

  GET DIAGNOSTICS renamed_count = ROW_COUNT;

  ALTER TABLE public.party_billing_records
    ENABLE TRIGGER trg_protect_billing_record;
  ALTER TABLE public.party_billing_records
    ENABLE TRIGGER trg_validate_billing_record_integrity;

  IF renamed_count > 0 THEN
    RAISE NOTICE
      'Renamed % duplicate party_billing_records.bill_ref_no value(s) with -Dxxxxxx suffix.',
      renamed_count;
  END IF;
END $$;

-- 2) Auto-resolve duplicates inside broker_challan_billing_records
DO $$
DECLARE
  renamed_count integer := 0;
  has_integrity_trg boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.broker_challan_billing_records'::regclass
      AND tgname = 'trg_validate_broker_challan_billing_record_integrity'
      AND NOT tgisinternal
  ) INTO has_integrity_trg;

  IF has_integrity_trg THEN
    ALTER TABLE public.broker_challan_billing_records
      DISABLE TRIGGER trg_validate_broker_challan_billing_record_integrity;
  END IF;

  WITH ranked AS (
    SELECT
      id,
      bill_ref_no,
      ROW_NUMBER() OVER (
        PARTITION BY UPPER(TRIM(bill_ref_no))
        ORDER BY
          CASE WHEN status = 'ACTIVE' THEN 0 ELSE 1 END,
          created_at ASC NULLS LAST,
          id ASC
      ) AS rn
    FROM public.broker_challan_billing_records
    WHERE bill_ref_no IS NOT NULL
      AND TRIM(bill_ref_no) <> ''
  ),
  to_rename AS (
    SELECT
      id,
      TRIM(bill_ref_no) || '-D' || SUBSTRING(REPLACE(id::text, '-', ''), 1, 6) AS new_ref
    FROM ranked
    WHERE rn > 1
  )
  UPDATE public.broker_challan_billing_records bcbr
  SET bill_ref_no = tr.new_ref
  FROM to_rename tr
  WHERE bcbr.id = tr.id;

  GET DIAGNOSTICS renamed_count = ROW_COUNT;

  IF has_integrity_trg THEN
    ALTER TABLE public.broker_challan_billing_records
      ENABLE TRIGGER trg_validate_broker_challan_billing_record_integrity;
  END IF;

  IF renamed_count > 0 THEN
    RAISE NOTICE
      'Renamed % duplicate broker_challan_billing_records.bill_ref_no value(s) with -Dxxxxxx suffix.',
      renamed_count;
  END IF;
END $$;

-- 3) Cross-table clash: rename broker side when it collides with a party bill
DO $$
DECLARE
  renamed_count integer := 0;
BEGIN
  WITH clashes AS (
    SELECT
      bcbr.id,
      TRIM(bcbr.bill_ref_no) || '-D' || SUBSTRING(REPLACE(bcbr.id::text, '-', ''), 1, 6) AS new_ref
    FROM public.broker_challan_billing_records bcbr
    JOIN public.party_billing_records pbr
      ON UPPER(TRIM(pbr.bill_ref_no)) = UPPER(TRIM(bcbr.bill_ref_no))
    WHERE bcbr.bill_ref_no IS NOT NULL
      AND pbr.bill_ref_no IS NOT NULL
  )
  UPDATE public.broker_challan_billing_records bcbr
  SET bill_ref_no = c.new_ref
  FROM clashes c
  WHERE bcbr.id = c.id;

  GET DIAGNOSTICS renamed_count = ROW_COUNT;

  IF renamed_count > 0 THEN
    RAISE NOTICE
      'Renamed % broker bill_ref_no value(s) that collided with party bills.',
      renamed_count;
  END IF;
END $$;

-- 4) Unique index: within party_billing_records (case-insensitive)
DROP INDEX IF EXISTS public.uix_pbr_bill_ref_no_upper;
CREATE UNIQUE INDEX uix_pbr_bill_ref_no_upper
  ON public.party_billing_records (UPPER(TRIM(bill_ref_no)))
  WHERE bill_ref_no IS NOT NULL;

-- 5) Unique index: within broker_challan_billing_records (case-insensitive)
DROP INDEX IF EXISTS public.uix_bcbr_bill_ref_no_upper;
CREATE UNIQUE INDEX uix_bcbr_bill_ref_no_upper
  ON public.broker_challan_billing_records (UPPER(TRIM(bill_ref_no)))
  WHERE bill_ref_no IS NOT NULL;

-- 6) Cross-table uniqueness trigger
CREATE OR REPLACE FUNCTION public.fn_validate_bill_ref_no_cross_table()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_ref text;
  cross_existing_id uuid;
BEGIN
  IF NEW.bill_ref_no IS NULL THEN
    RETURN NEW;
  END IF;

  normalized_ref := UPPER(TRIM(NEW.bill_ref_no));

  IF TG_TABLE_NAME = 'party_billing_records' THEN
    SELECT id INTO cross_existing_id
    FROM public.broker_challan_billing_records
    WHERE UPPER(TRIM(bill_ref_no)) = normalized_ref
    LIMIT 1;
  ELSE
    SELECT id INTO cross_existing_id
    FROM public.party_billing_records
    WHERE UPPER(TRIM(bill_ref_no)) = normalized_ref
    LIMIT 1;
  END IF;

  IF cross_existing_id IS NOT NULL THEN
    RAISE EXCEPTION
      'Bill reference number % already exists in a different billing table.',
      NEW.bill_ref_no
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_validate_bill_ref_no_cross_table() TO authenticated;

DROP TRIGGER IF EXISTS trg_pbr_bill_ref_no_cross_table ON public.party_billing_records;
CREATE TRIGGER trg_pbr_bill_ref_no_cross_table
  BEFORE INSERT OR UPDATE OF bill_ref_no
  ON public.party_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_bill_ref_no_cross_table();

DROP TRIGGER IF EXISTS trg_bcbr_bill_ref_no_cross_table ON public.broker_challan_billing_records;
CREATE TRIGGER trg_bcbr_bill_ref_no_cross_table
  BEFORE INSERT OR UPDATE OF bill_ref_no
  ON public.broker_challan_billing_records
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_validate_bill_ref_no_cross_table();

NOTIFY pgrst, 'reload schema';
