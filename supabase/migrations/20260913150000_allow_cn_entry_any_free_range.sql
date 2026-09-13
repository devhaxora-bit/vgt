-- Allow CN entry in ANY assigned branch range that still has that number free,
-- even when a different range is currently Active.
-- Example: Active 6801–7000, but free CN 5950 in older 5901–6000 → entry allowed.

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
  v_branch public.branches;
  v_active_range public.branch_cn_ranges;
  v_target public.branch_cn_ranges;
  v_scan BIGINT;
  v_next BIGINT;
  v_was_active BOOLEAN;
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

  -- Keep an active range when possible (for default Next CN), but do not require
  -- the typed CN to belong only to that active range.
  v_active_range := public.ensure_active_cn_range(v_branch.id);

  SELECT *
  INTO v_target
  FROM public.branch_cn_ranges
  WHERE branch_id = v_branch.id
    AND status IN ('active', 'pending', 'exhausted')
    AND p_cn_no BETWEEN range_start AND range_end
  ORDER BY
    CASE status WHEN 'active' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,
    created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    IF v_active_range IS NULL THEN
      RAISE EXCEPTION 'No CN range is configured for branch %.', v_branch.code;
    END IF;

    RAISE EXCEPTION
      'CN % is outside all assigned ranges for branch %. Active range is %-% .',
      p_cn_no,
      v_branch.code,
      v_active_range.range_start,
      v_active_range.range_end;
  END IF;

  IF public.live_consignment_cn_exists(p_cn_no) THEN
    RAISE EXCEPTION 'CN % is already used. Enter a different CN number.', p_cn_no;
  END IF;

  v_was_active := (v_target.status = 'active');

  -- Recompute Next CN for this owning range, treating p_cn_no as about-to-be-used.
  v_scan := v_target.range_start;
  LOOP
    EXIT WHEN v_scan > v_target.range_end;
    IF v_scan <> p_cn_no AND NOT public.live_consignment_cn_exists(v_scan) THEN
      EXIT;
    END IF;
    v_scan := v_scan + 1;
  END LOOP;

  v_next := v_scan;

  UPDATE public.branch_cn_ranges AS bcr
  SET next_cn_no = v_next,
      status = CASE
        WHEN v_next > bcr.range_end THEN 'exhausted'
        WHEN v_was_active THEN 'active'
        -- Older/queued ranges with remaining free numbers stay queued;
        -- they do not steal the active slot.
        ELSE 'pending'
      END
  WHERE bcr.id = v_target.id
  RETURNING bcr.*
  INTO v_target;

  IF v_was_active THEN
    IF v_target.status = 'exhausted' THEN
      v_active_range := public.promote_next_pending_cn_range(v_branch.id);
    ELSE
      UPDATE public.branches AS b
      SET next_cn_no = v_target.next_cn_no
      WHERE b.id = v_branch.id;
      v_active_range := v_target;
    END IF;
  ELSE
    -- Keep branch pointer on the current active range.
    IF v_active_range IS NOT NULL AND v_active_range.id IS DISTINCT FROM v_target.id THEN
      NULL;
    ELSIF v_active_range IS NULL AND v_target.status = 'pending' THEN
      -- No active range left; promote this free range.
      UPDATE public.branch_cn_ranges
      SET status = 'active'
      WHERE id = v_target.id
      RETURNING *
      INTO v_target;

      UPDATE public.branches
      SET next_cn_no = v_target.next_cn_no
      WHERE id = v_branch.id;

      v_active_range := v_target;
    END IF;
  END IF;

  consumed_cn_no := p_cn_no;
  next_cn_no := COALESCE(v_active_range.next_cn_no, v_target.next_cn_no, v_next);
  range_start := COALESCE(v_active_range.range_start, v_target.range_start);
  range_end := COALESCE(v_active_range.range_end, v_target.range_end);
  status := COALESCE(v_active_range.status, v_target.status);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_branch_cn_sequence(TEXT, BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
