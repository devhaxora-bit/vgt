-- Multi-branch visibility for parties (one party record / ledger; many branch tags).
-- Home ownership stays on parties.branch_code; party_branches controls which branches
-- can see/select the party. GSTIN remains globally unique among active parties.

CREATE TABLE IF NOT EXISTS public.party_branches (
  party_id UUID NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  branch_code TEXT NOT NULL REFERENCES public.branches(code) ON UPDATE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id),
  PRIMARY KEY (party_id, branch_code)
);

CREATE INDEX IF NOT EXISTS idx_party_branches_branch_code
  ON public.party_branches (branch_code);

CREATE INDEX IF NOT EXISTS idx_party_branches_party_id
  ON public.party_branches (party_id);

COMMENT ON TABLE public.party_branches IS
  'Branches that can see/use a party. Ledger and calculations stay on parties.id.';

-- Backfill: every party is tagged to its home branch
INSERT INTO public.party_branches (party_id, branch_code)
SELECT p.id, p.branch_code
FROM public.parties p
WHERE p.branch_code IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE public.party_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "party_branches_select" ON public.party_branches;
CREATE POLICY "party_branches_select"
ON public.party_branches
FOR SELECT TO authenticated
USING (public.can_access_branch(branch_code));

DROP POLICY IF EXISTS "party_branches_insert" ON public.party_branches;
CREATE POLICY "party_branches_insert"
ON public.party_branches
FOR INSERT TO authenticated
WITH CHECK (
  public.can_create_master_data(auth.uid())
  AND public.can_access_branch(branch_code)
);

DROP POLICY IF EXISTS "party_branches_delete" ON public.party_branches;
CREATE POLICY "party_branches_delete"
ON public.party_branches
FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid())
  AND public.can_access_branch(branch_code)
);

-- Keep home-branch tag in sync on insert / home-branch change
CREATE OR REPLACE FUNCTION public.ensure_party_home_branch_tag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.branch_code IS NOT NULL AND BTRIM(NEW.branch_code) <> '' THEN
    INSERT INTO public.party_branches (party_id, branch_code)
    VALUES (NEW.id, UPPER(BTRIM(NEW.branch_code)))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_party_home_branch_tag ON public.parties;
CREATE TRIGGER trg_ensure_party_home_branch_tag
AFTER INSERT OR UPDATE OF branch_code ON public.parties
FOR EACH ROW
EXECUTE FUNCTION public.ensure_party_home_branch_tag();

-- Visible if home branch OR any tagged branch is in scope
DROP POLICY IF EXISTS "parties_select_branch" ON public.parties;
CREATE POLICY "parties_select_branch"
ON public.parties
FOR SELECT TO authenticated
USING (
  (
    public.can_access_branch(branch_code)
    OR EXISTS (
      SELECT 1
      FROM public.party_branches pb
      WHERE pb.party_id = parties.id
        AND public.can_access_branch(pb.branch_code)
    )
  )
  AND (
    is_active = true
    OR EXISTS (
      SELECT 1 FROM public.party_ledger_accounts pla
      WHERE pla.party_id = parties.id AND pla.opening_balance <> 0
    )
    OR EXISTS (
      SELECT 1 FROM public.party_billing_records pbr
      WHERE pbr.party_id = parties.id AND pbr.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM public.party_payment_receipts ppr
      WHERE ppr.party_id = parties.id AND ppr.status = 'ACTIVE'
    )
    OR EXISTS (
      SELECT 1 FROM public.consignments c
      WHERE c.billing_party_id = parties.id
        AND c.cancel_cn = false
        AND c.deleted_at IS NULL
    )
  )
);

-- Cross-branch GSTIN lookup (bypasses branch RLS for match only)
CREATE OR REPLACE FUNCTION public.find_active_party_by_gstin(p_gstin TEXT)
RETURNS public.parties
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_party public.parties;
  v_gstin TEXT := UPPER(BTRIM(COALESCE(p_gstin, '')));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF v_gstin = '' THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO v_party
  FROM public.parties
  WHERE is_active = true
    AND gstin IS NOT NULL
    AND UPPER(TRIM(gstin)) = v_gstin
  ORDER BY code ASC
  LIMIT 1;

  RETURN v_party;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_active_party_by_gstin(TEXT) TO authenticated;

-- Tag an existing party onto a branch the caller can access
CREATE OR REPLACE FUNCTION public.link_party_to_branch(
  p_party_id UUID,
  p_branch_code TEXT
)
RETURNS public.parties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_branch TEXT := UPPER(BTRIM(COALESCE(p_branch_code, '')));
  v_party public.parties;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.can_create_master_data(auth.uid()) THEN
    RAISE EXCEPTION 'You do not have permission to add parties to a branch.';
  END IF;

  IF v_branch = '' THEN
    RAISE EXCEPTION 'Branch is required.';
  END IF;

  IF NOT public.can_access_branch(v_branch) THEN
    RAISE EXCEPTION 'You can only add parties to your own branch.';
  END IF;

  SELECT *
  INTO v_party
  FROM public.parties
  WHERE id = p_party_id
    AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Party not found or inactive.';
  END IF;

  INSERT INTO public.party_branches (party_id, branch_code, created_by)
  VALUES (p_party_id, v_branch, auth.uid())
  ON CONFLICT DO NOTHING;

  RETURN v_party;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_party_to_branch(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
