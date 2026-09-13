-- Reconcile CN range status from live consignments.
-- If even one CN in a range is free (e.g. after soft-delete), the range must
-- not stay Exhausted — it becomes Available (active) or Queued (pending).

CREATE OR REPLACE FUNCTION public.reconcile_branch_cn_ranges(
  p_branch_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range public.branch_cn_ranges;
  v_next BIGINT;
  v_active_id UUID;
  v_picked_active BOOLEAN := false;
BEGIN
  IF p_branch_id IS NULL THEN
    RETURN;
  END IF;

  -- First pass: refresh next_cn_no from the first free live CN in each range.
  FOR v_range IN
    SELECT *
    FROM public.branch_cn_ranges
    WHERE branch_id = p_branch_id
      AND status IN ('active', 'pending', 'exhausted')
    ORDER BY created_at ASC, range_start ASC
    FOR UPDATE
  LOOP
    v_next := public.next_available_branch_cn(v_range.id, v_range.range_start);

    UPDATE public.branch_cn_ranges
    SET next_cn_no = v_next,
        status = CASE
          WHEN v_next > range_end THEN 'exhausted'
          ELSE status -- temporary; second pass assigns active/pending
        END
    WHERE id = v_range.id;
  END LOOP;

  -- Prefer keeping the current active range if it still has free numbers.
  SELECT id
  INTO v_active_id
  FROM public.branch_cn_ranges
  WHERE branch_id = p_branch_id
    AND status = 'active'
    AND next_cn_no <= range_end
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_active_id IS NOT NULL THEN
    v_picked_active := true;
  END IF;

  -- Second pass: one Available (active), remaining free ranges Queued (pending).
  FOR v_range IN
    SELECT *
    FROM public.branch_cn_ranges
    WHERE branch_id = p_branch_id
      AND status IN ('active', 'pending', 'exhausted')
    ORDER BY created_at ASC, range_start ASC
    FOR UPDATE
  LOOP
    IF v_range.next_cn_no > v_range.range_end THEN
      UPDATE public.branch_cn_ranges
      SET status = 'exhausted'
      WHERE id = v_range.id;
      CONTINUE;
    END IF;

    IF v_active_id IS NOT NULL AND v_range.id = v_active_id THEN
      UPDATE public.branch_cn_ranges
      SET status = 'active'
      WHERE id = v_range.id;
      CONTINUE;
    END IF;

    IF NOT v_picked_active THEN
      UPDATE public.branch_cn_ranges
      SET status = 'active'
      WHERE id = v_range.id;
      v_active_id := v_range.id;
      v_picked_active := true;

      UPDATE public.branches
      SET next_cn_no = v_range.next_cn_no
      WHERE id = p_branch_id;
    ELSE
      UPDATE public.branch_cn_ranges
      SET status = 'pending'
      WHERE id = v_range.id;
    END IF;
  END LOOP;

  -- Sync branch pointer from the active range (if any).
  IF v_active_id IS NOT NULL THEN
    UPDATE public.branches b
    SET next_cn_no = r.next_cn_no
    FROM public.branch_cn_ranges r
    WHERE r.id = v_active_id
      AND b.id = p_branch_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reconcile_branch_cn_ranges(UUID) TO authenticated;

-- Soft-delete: always reconcile the branch so freed numbers reopen the range.
CREATE OR REPLACE FUNCTION public.release_cn_number_after_soft_delete(
  p_cn_no TEXT,
  p_booking_branch TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cn BIGINT;
  v_branch public.branches;
BEGIN
  IF p_cn_no IS NULL OR p_cn_no !~ '^\d+$' THEN
    RETURN;
  END IF;

  v_cn := p_cn_no::bigint;

  SELECT *
  INTO v_branch
  FROM public.branches
  WHERE UPPER(code) = UPPER(BTRIM(p_booking_branch))
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Rewind pointer on the matching range first (active or exhausted/pending).
  UPDATE public.branch_cn_ranges
  SET next_cn_no = LEAST(v_cn, next_cn_no)
  WHERE branch_id = v_branch.id
    AND status IN ('active', 'pending', 'exhausted')
    AND v_cn BETWEEN range_start AND range_end;

  PERFORM public.reconcile_branch_cn_ranges(v_branch.id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_cn_number_after_soft_delete(TEXT, TEXT) TO authenticated;

-- One-time repair for all branches with managed ranges.
DO $$
DECLARE
  v_branch_id UUID;
BEGIN
  FOR v_branch_id IN
    SELECT DISTINCT branch_id
    FROM public.branch_cn_ranges
  LOOP
    PERFORM public.reconcile_branch_cn_ranges(v_branch_id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
