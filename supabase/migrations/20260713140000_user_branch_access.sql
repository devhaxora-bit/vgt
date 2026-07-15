-- ============================================================
-- User branch access: global / main / branch
-- global and main have the same full multi-branch rights
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS branch_access TEXT NOT NULL DEFAULT 'global'
    CHECK (branch_access IN ('global', 'main', 'branch'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS branch_code VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_branch_code_fkey'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_branch_code_fkey
      FOREIGN KEY (branch_code)
      REFERENCES public.branches(code)
      ON UPDATE CASCADE
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_branch_access ON public.users(branch_access);
CREATE INDEX IF NOT EXISTS idx_users_branch_code ON public.users(branch_code);

COMMENT ON COLUMN public.users.branch_access IS
  'global = all branches; main = head/main branch with same rights as global; branch = scoped to branch_code';

-- All existing accounts become global (full rights across branches)
UPDATE public.users
SET branch_access = 'global',
    branch_code = NULL;

-- New auth-triggered users default to global access
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, full_name, employee_code, role, is_active, branch_access, branch_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'EMP-' || substr(NEW.id::text, 1, 8),
    'employee',
    true,
    'global',
    NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
