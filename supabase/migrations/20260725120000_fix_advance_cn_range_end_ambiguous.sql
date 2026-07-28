-- Fix: "column reference range_end is ambiguous" when saving CNs.
-- advance_branch_cn_sequence RETURNS TABLE (... range_end ...) so unqualified
-- range_end / next_cn_no / range_start / status inside the function body collide
-- with the OUT parameters.

CREATE OR REPLACE FUNCTION public.advance_branch_cn_sequence(
  p_branch_code TEXT,
  p_cn_no BIGINT
)
RETURNS TABLE (
  consumed_cn_no BIGINT,
  next_cn_no BIGINT,
  range_start BIGINT,
  range_end BIGINT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_range public.branch_cn_ranges;
  v_branch public.branches;
  v_current BIGINT;
  v_next BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT b.*
  INTO v_branch
  FROM public.branches b
  WHERE UPPER(b.code) = UPPER(BTRIM(p_branch_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Branch % not found.', UPPER(BTRIM(p_branch_code));
  END IF;

  v_active_range := public.ensure_active_cn_range(v_branch.id);

  IF v_active_range IS NULL THEN
    RAISE EXCEPTION 'No active or queued CN range configured for branch %.', v_branch.code;
  END IF;

  v_current := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

  IF v_current > v_active_range.range_end THEN
    RAISE EXCEPTION 'CN range %-% is exhausted for branch %.',
      v_active_range.range_start,
      v_active_range.range_end,
      v_branch.code;
  END IF;

  IF p_cn_no <> v_current THEN
    RAISE EXCEPTION 'CN % is not the next available CN for branch %. Expected %.',
      p_cn_no,
      v_branch.code,
      v_current;
  END IF;

  v_next := public.next_available_branch_cn(v_active_range.id, v_current + 1);

  UPDATE public.branch_cn_ranges AS bcr
  SET next_cn_no = v_next,
      status = CASE
        WHEN v_next > bcr.range_end THEN 'exhausted'
        ELSE 'active'
      END
  WHERE bcr.id = v_active_range.id
  RETURNING bcr.*
  INTO v_active_range;

  IF v_active_range.status = 'exhausted' THEN
    v_active_range := public.promote_next_pending_cn_range(v_branch.id);
  ELSE
    UPDATE public.branches AS b
    SET next_cn_no = v_active_range.next_cn_no
    WHERE b.id = v_branch.id;
  END IF;

  consumed_cn_no := p_cn_no;
  next_cn_no := COALESCE(v_active_range.next_cn_no, v_next);
  range_start := COALESCE(v_active_range.range_start, 0);
  range_end := COALESCE(v_active_range.range_end, 0);
  status := COALESCE(v_active_range.status, 'exhausted');
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_branch_cn_sequence(TEXT, BIGINT) TO authenticated;

-- Also qualify promote helper for safety (same pattern)
CREATE OR REPLACE FUNCTION public.promote_next_pending_cn_range(
  p_branch_id UUID
)
RETURNS public.branch_cn_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending public.branch_cn_ranges;
  v_next BIGINT;
BEGIN
  SELECT *
  INTO v_pending
  FROM public.branch_cn_ranges
  WHERE branch_id = p_branch_id
    AND status = 'pending'
  ORDER BY created_at ASC, range_start ASC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  v_next := public.next_available_branch_cn(v_pending.id, v_pending.next_cn_no);

  UPDATE public.branch_cn_ranges AS bcr
  SET next_cn_no = v_next,
      status = CASE
        WHEN v_next > bcr.range_end THEN 'exhausted'
        ELSE 'active'
      END
  WHERE bcr.id = v_pending.id
  RETURNING bcr.*
  INTO v_pending;

  IF v_pending.status = 'exhausted' THEN
    RETURN public.promote_next_pending_cn_range(p_branch_id);
  END IF;

  UPDATE public.branches AS b
  SET next_cn_no = v_pending.next_cn_no
  WHERE b.id = p_branch_id;

  RETURN v_pending;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_next_pending_cn_range(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
