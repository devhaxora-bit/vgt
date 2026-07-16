-- ============================================================
-- Multi-range CN queue per branch
-- - active: currently issuing CNs
-- - pending: queued; auto-activates when previous range exhausts
-- - exhausted / inactive: historical
-- Admins may update/delete ranges only when no CNs exist in that block.
-- ============================================================

-- 1. Allow pending status
ALTER TABLE public.branch_cn_ranges
  DROP CONSTRAINT IF EXISTS branch_cn_ranges_status_check;

ALTER TABLE public.branch_cn_ranges
  ADD CONSTRAINT branch_cn_ranges_status_check
  CHECK (status IN ('active', 'pending', 'exhausted', 'inactive'));

-- 2. Active + pending ranges must not overlap across branches
ALTER TABLE public.branch_cn_ranges
  DROP CONSTRAINT IF EXISTS branch_cn_ranges_no_overlap;

ALTER TABLE public.branch_cn_ranges
  ADD CONSTRAINT branch_cn_ranges_no_overlap
  EXCLUDE USING gist (
    int8range(range_start, range_end + 1, '[)') WITH &&
  ) WHERE (status IN ('active', 'pending'));

-- 3. True when any consignment CN exists inside a numeric block
CREATE OR REPLACE FUNCTION public.cn_range_has_consignments(
  p_range_start BIGINT,
  p_range_end BIGINT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consignments c
    WHERE c.cn_no ~ '^\d+$'
      AND c.cn_no::bigint BETWEEN p_range_start AND p_range_end
  );
$$;

GRANT EXECUTE ON FUNCTION public.cn_range_has_consignments(BIGINT, BIGINT) TO authenticated;

-- 4. Promote the oldest pending range for a branch to active
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

  UPDATE public.branch_cn_ranges
  SET next_cn_no = v_next,
      status = CASE
        WHEN v_next > range_end THEN 'exhausted'
        ELSE 'active'
      END
  WHERE id = v_pending.id
  RETURNING *
  INTO v_pending;

  IF v_pending.status = 'exhausted' THEN
    RETURN public.promote_next_pending_cn_range(p_branch_id);
  END IF;

  UPDATE public.branches
  SET next_cn_no = v_pending.next_cn_no
  WHERE id = p_branch_id;

  RETURN v_pending;
END;
$$;

GRANT EXECUTE ON FUNCTION public.promote_next_pending_cn_range(UUID) TO authenticated;

-- 5. Ensure branch has an active range (promote pending if needed)
CREATE OR REPLACE FUNCTION public.ensure_active_cn_range(
  p_branch_id UUID
)
RETURNS public.branch_cn_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active public.branch_cn_ranges;
  v_next BIGINT;
BEGIN
  SELECT *
  INTO v_active
  FROM public.branch_cn_ranges
  WHERE branch_id = p_branch_id
    AND status = 'active'
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    v_next := public.next_available_branch_cn(v_active.id, v_active.next_cn_no);

    IF v_next > v_active.range_end THEN
      UPDATE public.branch_cn_ranges
      SET next_cn_no = v_next,
          status = 'exhausted'
      WHERE id = v_active.id
      RETURNING *
      INTO v_active;

      RETURN public.promote_next_pending_cn_range(p_branch_id);
    END IF;

    IF v_next <> v_active.next_cn_no THEN
      UPDATE public.branch_cn_ranges
      SET next_cn_no = v_next
      WHERE id = v_active.id
      RETURNING *
      INTO v_active;

      UPDATE public.branches
      SET next_cn_no = v_active.next_cn_no
      WHERE id = p_branch_id;
    END IF;

    RETURN v_active;
  END IF;

  RETURN public.promote_next_pending_cn_range(p_branch_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_active_cn_range(UUID) TO authenticated;

-- 6. Issue a new range: queue when another range is still active
CREATE OR REPLACE FUNCTION public.create_branch_cn_range(
  p_branch_id   UUID,
  p_range_start BIGINT,
  p_range_end   BIGINT,
  p_note        TEXT DEFAULT NULL
)
RETURNS public.branch_cn_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_range public.branch_cn_ranges;
  v_candidate BIGINT;
  v_cn_exists BOOLEAN;
  v_has_active BOOLEAN;
  v_initial_status TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can manage branch CN ranges.';
  END IF;

  IF p_range_start > p_range_end THEN
    RAISE EXCEPTION 'Range start must be less than or equal to range end.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.branches
    WHERE id = p_branch_id
      AND COALESCE(is_active, true) = true
  ) THEN
    RAISE EXCEPTION 'Branch % not found or is inactive.', p_branch_id;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.branch_cn_ranges
    WHERE branch_id = p_branch_id
      AND status = 'active'
  ) INTO v_has_active;

  v_initial_status := CASE WHEN v_has_active THEN 'pending' ELSE 'active' END;

  v_candidate := p_range_start;
  LOOP
    EXIT WHEN v_candidate > p_range_end;

    SELECT EXISTS(
      SELECT 1
      FROM public.consignments
      WHERE cn_no ~ '^\d+$'
        AND cn_no::bigint = v_candidate
    ) INTO v_cn_exists;

    IF NOT v_cn_exists THEN
      EXIT;
    END IF;

    v_candidate := v_candidate + 1;
  END LOOP;

  INSERT INTO public.branch_cn_ranges (
    branch_id, range_start, range_end, next_cn_no, status, note, assigned_by
  )
  VALUES (
    p_branch_id,
    p_range_start,
    p_range_end,
    v_candidate,
    CASE
      WHEN v_candidate > p_range_end THEN 'exhausted'
      ELSE v_initial_status
    END,
    NULLIF(BTRIM(p_note), ''),
    auth.uid()
  )
  RETURNING *
  INTO v_new_range;

  IF v_new_range.status = 'active' THEN
    UPDATE public.branches
    SET next_cn_no = v_new_range.next_cn_no
    WHERE id = p_branch_id;
  END IF;

  RETURN v_new_range;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION
      'CN range % – % overlaps a range already assigned to another branch. Each CN block can only be issued to one branch.',
      p_range_start, p_range_end;
END;
$$;

-- 7. Advance sequence; auto-promote queued ranges when current exhausts
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

  UPDATE public.branch_cn_ranges
  SET next_cn_no = v_next,
      status = CASE
        WHEN v_next > range_end THEN 'exhausted'
        ELSE 'active'
      END
  WHERE id = v_active_range.id
  RETURNING *
  INTO v_active_range;

  IF v_active_range.status = 'exhausted' THEN
    v_active_range := public.promote_next_pending_cn_range(v_branch.id);
  ELSE
    UPDATE public.branches
    SET next_cn_no = v_active_range.next_cn_no
    WHERE id = v_branch.id;
  END IF;

  consumed_cn_no := p_cn_no;
  next_cn_no := COALESCE(v_active_range.next_cn_no, v_next);
  range_start := COALESCE(v_active_range.range_start, 0);
  range_end := COALESCE(v_active_range.range_end, 0);
  status := COALESCE(v_active_range.status, 'exhausted');
  RETURN NEXT;
END;
$$;

-- 8. Update a queued/unused range
CREATE OR REPLACE FUNCTION public.update_branch_cn_range(
  p_range_id UUID,
  p_range_start BIGINT,
  p_range_end BIGINT,
  p_note TEXT DEFAULT NULL
)
RETURNS public.branch_cn_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range public.branch_cn_ranges;
  v_candidate BIGINT;
  v_cn_exists BOOLEAN;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can manage branch CN ranges.';
  END IF;

  IF p_range_start > p_range_end THEN
    RAISE EXCEPTION 'Range start must be less than or equal to range end.';
  END IF;

  SELECT *
  INTO v_range
  FROM public.branch_cn_ranges
  WHERE id = p_range_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CN range % not found.', p_range_id;
  END IF;

  IF v_range.status = 'active' THEN
    RAISE EXCEPTION 'Active ranges cannot be edited. Issue a new queued range instead.';
  END IF;

  IF v_range.status NOT IN ('pending', 'inactive') THEN
    RAISE EXCEPTION 'Only pending or inactive ranges can be edited.';
  END IF;

  IF public.cn_range_has_consignments(v_range.range_start, v_range.range_end) THEN
    RAISE EXCEPTION 'Cannot edit this range because consignments already exist inside % – %.',
      v_range.range_start, v_range.range_end;
  END IF;

  v_candidate := p_range_start;
  LOOP
    EXIT WHEN v_candidate > p_range_end;

    SELECT EXISTS(
      SELECT 1
      FROM public.consignments
      WHERE cn_no ~ '^\d+$'
        AND cn_no::bigint = v_candidate
    ) INTO v_cn_exists;

    IF NOT v_cn_exists THEN
      EXIT;
    END IF;

    v_candidate := v_candidate + 1;
  END LOOP;

  UPDATE public.branch_cn_ranges
  SET range_start = p_range_start,
      range_end = p_range_end,
      next_cn_no = v_candidate,
      status = CASE
        WHEN v_range.status = 'pending' AND v_candidate <= p_range_end THEN 'pending'
        WHEN v_candidate > p_range_end THEN 'exhausted'
        ELSE v_range.status
      END,
      note = COALESCE(NULLIF(BTRIM(p_note), ''), note)
  WHERE id = p_range_id
  RETURNING *
  INTO v_range;

  RETURN v_range;
EXCEPTION
  WHEN exclusion_violation THEN
    RAISE EXCEPTION
      'CN range % – % overlaps a range already assigned to another branch.',
      p_range_start, p_range_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_branch_cn_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;

-- 9. Delete a queued/unused range
CREATE OR REPLACE FUNCTION public.delete_branch_cn_range(
  p_range_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range public.branch_cn_ranges;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can manage branch CN ranges.';
  END IF;

  SELECT *
  INTO v_range
  FROM public.branch_cn_ranges
  WHERE id = p_range_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CN range % not found.', p_range_id;
  END IF;

  IF v_range.status = 'active' THEN
    RAISE EXCEPTION 'Active ranges cannot be deleted.';
  END IF;

  IF v_range.status NOT IN ('pending', 'inactive') THEN
    RAISE EXCEPTION 'Only pending or inactive ranges can be deleted.';
  END IF;

  IF public.cn_range_has_consignments(v_range.range_start, v_range.range_end) THEN
    RAISE EXCEPTION 'Cannot delete this range because consignments already exist inside % – %.',
      v_range.range_start, v_range.range_end;
  END IF;

  DELETE FROM public.branch_cn_ranges
  WHERE id = p_range_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_branch_cn_range(UUID) TO authenticated;

-- 10. Branch deactivation should release active + pending ranges
CREATE OR REPLACE FUNCTION public.fn_deactivate_branch_cn_ranges_on_branch_inactive()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false THEN
    UPDATE public.branch_cn_ranges
    SET status = CASE
      WHEN next_cn_no > range_end THEN 'exhausted'
      ELSE 'inactive'
    END
    WHERE branch_id = NEW.id
      AND status IN ('active', 'pending');
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
