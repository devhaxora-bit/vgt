-- Link all parties to the Vizianagaram branch (VZM)

-- Ensure the Vizianagaram branch exists
INSERT INTO public.branches (code, name, type, city, state)
SELECT
    'VZM',
    'Vizianagaram Branch',
    'Hub',
    'Vizianagaram',
    'Andhra Pradesh'
WHERE NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE code = 'VZM'
);

-- Backfill every existing party to Vizianagaram
UPDATE public.parties
SET
    branch_code = 'VZM',
    updated_at = NOW()
WHERE branch_code IS DISTINCT FROM 'VZM';

-- Enforce branch linkage for future party records
ALTER TABLE public.parties
    ALTER COLUMN branch_code SET DEFAULT 'VZM';

ALTER TABLE public.parties
    ALTER COLUMN branch_code SET NOT NULL;

-- Add FK to branches if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'parties_branch_code_fkey'
    ) THEN
        ALTER TABLE public.parties
            ADD CONSTRAINT parties_branch_code_fkey
            FOREIGN KEY (branch_code)
            REFERENCES public.branches (code)
            ON UPDATE CASCADE
            ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parties_branch_code
    ON public.parties (branch_code);

COMMENT ON COLUMN public.parties.branch_code IS
    'Branch that owns this party. Defaults to VZM (Vizianagaram).';
