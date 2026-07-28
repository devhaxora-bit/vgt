-- Allow manual CN entry within the branch's assigned active range.
-- Still rejects: out-of-range CNs, exhausted ranges, and already-used (live) CNs.
-- Sequence pointer only advances when the consumed CN is the current next available.

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
    RAISE EXCEPTION 'No active CN range is configured for branch %.', v_branch.code;
  END IF;

  IF p_cn_no < v_active_range.range_start OR p_cn_no > v_active_range.range_end THEN
    RAISE EXCEPTION 'CN % is outside the assigned range %-% for branch %.',
      p_cn_no,
      v_active_range.range_start,
      v_active_range.range_end,
      v_branch.code;
  END IF;

  IF public.live_consignment_cn_exists(p_cn_no) THEN
    RAISE EXCEPTION 'CN % is already used. Enter a different CN number.', p_cn_no;
  END IF;

  v_current := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

  -- Only move the sequence forward when consuming the current next available CN.
  -- Manual entries that fill holes or jump ahead leave next_cn_no unchanged
  -- (except when the chosen CN was itself the next available).
  IF p_cn_no = v_current THEN
    v_next := public.next_available_branch_cn(v_active_range.id, p_cn_no + 1);

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
  ELSE
    -- Hole / skip: keep pointer; still return current range state.
    v_next := v_current;
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

NOTIFY pgrst, 'reload schema';
