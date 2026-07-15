-- ============================================================
-- Branch ownership for brokers + vehicles masters
-- Existing rows are backfilled to head branch (else VZM / first active).
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

  -- ---------- BROKERS ----------
  ALTER TABLE public.brokers
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(10);

  UPDATE public.brokers
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.brokers ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.brokers
    ALTER COLUMN branch_code SET NOT NULL;

  -- Allow same broker code on different branches
  ALTER TABLE public.brokers
    DROP CONSTRAINT IF EXISTS brokers_code_key;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brokers_code_branch_key'
  ) THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_code_branch_key UNIQUE (code, branch_code);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'brokers_branch_code_fkey'
  ) THEN
    ALTER TABLE public.brokers
      ADD CONSTRAINT brokers_branch_code_fkey
      FOREIGN KEY (branch_code)
      REFERENCES public.branches (code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_brokers_branch_code
    ON public.brokers (branch_code);

  COMMENT ON COLUMN public.brokers.branch_code IS
    'Branch that owns this broker master record.';

  -- ---------- VEHICLES ----------
  ALTER TABLE public.vehicles
    ADD COLUMN IF NOT EXISTS branch_code VARCHAR(10);

  UPDATE public.vehicles
  SET branch_code = default_branch
  WHERE branch_code IS NULL OR BTRIM(branch_code) = '';

  EXECUTE format(
    'ALTER TABLE public.vehicles ALTER COLUMN branch_code SET DEFAULT %L',
    default_branch
  );

  ALTER TABLE public.vehicles
    ALTER COLUMN branch_code SET NOT NULL;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_branch_code_fkey'
  ) THEN
    ALTER TABLE public.vehicles
      ADD CONSTRAINT vehicles_branch_code_fkey
      FOREIGN KEY (branch_code)
      REFERENCES public.branches (code)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;

  CREATE INDEX IF NOT EXISTS idx_vehicles_branch_code
    ON public.vehicles (branch_code);

  COMMENT ON COLUMN public.vehicles.branch_code IS
    'Branch that owns this vehicle master record.';
END $$;

NOTIFY pgrst, 'reload schema';
