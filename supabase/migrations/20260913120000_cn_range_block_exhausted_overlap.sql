-- Block overlapping CN ranges against history that still has live CNs.
-- Soft-deleted consignments free their CN numbers for reuse.
-- Exhausted ranges only block when live (non-deleted) CNs still exist
-- in the overlapping numbers. Active/pending always block.
-- Also improve "outside range" errors when the CN sits in a queued block.

-- 1. Soft-deleted CNs must not appear as "already used" in validation UI.
CREATE OR REPLACE FUNCTION public.get_existing_cns_in_range(
  p_range_start BIGINT,
  p_range_end   BIGINT
)
RETURNS TABLE(cn_num BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT c.cn_no::bigint AS cn_num
  FROM public.consignments c
  WHERE c.deleted_at IS NULL
    AND c.cn_no ~ '^\d+$'
    AND c.cn_no::bigint BETWEEN p_range_start AND p_range_end
  ORDER BY cn_num;
$$;

GRANT EXECUTE ON FUNCTION public.get_existing_cns_in_range(BIGINT, BIGINT) TO authenticated;

-- 2. Remove illegally overlapping pending/inactive ranges that conflict with
--    active/pending, or with exhausted ranges that still have live CNs.
DELETE FROM public.branch_cn_ranges AS candidate
WHERE candidate.status IN ('pending', 'inactive')
  AND EXISTS (
    SELECT 1
    FROM public.branch_cn_ranges AS other
    WHERE other.id <> candidate.id
      AND int8range(candidate.range_start, candidate.range_end + 1, '[)')
          && int8range(other.range_start, other.range_end + 1, '[)')
      AND (
        other.status IN ('active', 'pending')
        OR (
          other.status = 'exhausted'
          AND EXISTS (
            SELECT 1
            FROM public.consignments c
            WHERE c.deleted_at IS NULL
              AND c.cn_no ~ '^\d+$'
              AND c.cn_no::bigint BETWEEN
                GREATEST(candidate.range_start, other.range_start)
                AND LEAST(candidate.range_end, other.range_end)
          )
        )
      )
  );

-- 3. Exclusion covers active + pending only.
-- Exhausted overlaps are enforced in find_overlapping_cn_range with live-CN awareness
-- so soft-deleted numbers can be re-issued.
ALTER TABLE public.branch_cn_ranges
  DROP CONSTRAINT IF EXISTS branch_cn_ranges_no_overlap;

ALTER TABLE public.branch_cn_ranges
  ADD CONSTRAINT branch_cn_ranges_no_overlap
  EXCLUDE USING gist (
    int8range(range_start, range_end + 1, '[)') WITH &&
  ) WHERE (status IN ('active', 'pending'));

-- 4. Shared overlap lookup: active/pending always conflict;
--    exhausted only if live consignments remain in the overlap.
CREATE OR REPLACE FUNCTION public.find_overlapping_cn_range(
  p_range_start BIGINT,
  p_range_end BIGINT,
  p_exclude_range_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  branch_id UUID,
  branch_code TEXT,
  range_start BIGINT,
  range_end BIGINT,
  status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.branch_id,
    b.code AS branch_code,
    r.range_start,
    r.range_end,
    r.status
  FROM public.branch_cn_ranges r
  JOIN public.branches b ON b.id = r.branch_id
  WHERE (p_exclude_range_id IS NULL OR r.id <> p_exclude_range_id)
    AND int8range(r.range_start, r.range_end + 1, '[)')
        && int8range(p_range_start, p_range_end + 1, '[)')
    AND (
      r.status IN ('active', 'pending')
      OR (
        r.status = 'exhausted'
        AND EXISTS (
          SELECT 1
          FROM public.consignments c
          WHERE c.deleted_at IS NULL
            AND c.cn_no ~ '^\d+$'
            AND c.cn_no::bigint BETWEEN
              GREATEST(r.range_start, p_range_start)
              AND LEAST(r.range_end, p_range_end)
        )
      )
    )
  ORDER BY r.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_overlapping_cn_range(BIGINT, BIGINT, UUID) TO authenticated;

-- 4. Create: reject any overlap with active/pending/exhausted (any branch).
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
  v_has_active BOOLEAN;
  v_initial_status TEXT;
  v_overlap RECORD;
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

  SELECT *
  INTO v_overlap
  FROM public.find_overlapping_cn_range(p_range_start, p_range_end, NULL);

  IF FOUND THEN
    RAISE EXCEPTION
      'CN range % – % overlaps % range % – % on branch %. Choose a different block.',
      p_range_start,
      p_range_end,
      v_overlap.status,
      v_overlap.range_start,
      v_overlap.range_end,
      v_overlap.branch_code;
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
    EXIT WHEN NOT public.live_consignment_cn_exists(v_candidate);
    v_candidate := v_candidate + 1;
  END LOOP;

  IF v_candidate > p_range_end THEN
    RAISE EXCEPTION
      'All CN numbers in % – % are already used. Choose a different range.',
      p_range_start, p_range_end;
  END IF;

  INSERT INTO public.branch_cn_ranges (
    branch_id, range_start, range_end, next_cn_no, status, note, assigned_by
  )
  VALUES (
    p_branch_id,
    p_range_start,
    p_range_end,
    v_candidate,
    v_initial_status,
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
      'CN range % – % overlaps a range already assigned. Each CN block can only be issued once.',
      p_range_start, p_range_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_branch_cn_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;

-- 5. Update: same overlap rule (exclude self).
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
  v_overlap RECORD;
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

  SELECT *
  INTO v_overlap
  FROM public.find_overlapping_cn_range(p_range_start, p_range_end, p_range_id);

  IF FOUND THEN
    RAISE EXCEPTION
      'CN range % – % overlaps % range % – % on branch %. Choose a different block.',
      p_range_start,
      p_range_end,
      v_overlap.status,
      v_overlap.range_start,
      v_overlap.range_end,
      v_overlap.branch_code;
  END IF;

  v_candidate := p_range_start;
  LOOP
    EXIT WHEN v_candidate > p_range_end;
    EXIT WHEN NOT public.live_consignment_cn_exists(v_candidate);
    v_candidate := v_candidate + 1;
  END LOOP;

  IF v_candidate > p_range_end THEN
    RAISE EXCEPTION
      'All CN numbers in % – % are already used. Choose a different range.',
      p_range_start, p_range_end;
  END IF;

  UPDATE public.branch_cn_ranges
  SET range_start = p_range_start,
      range_end = p_range_end,
      next_cn_no = v_candidate,
      status = CASE
        WHEN v_range.status = 'pending' THEN 'pending'
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
      'CN range % – % overlaps a range already assigned.',
      p_range_start, p_range_end;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_branch_cn_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;

-- 6. Clearer outside-range message when CN belongs to a queued block.
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
  v_queued public.branch_cn_ranges;
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
    SELECT *
    INTO v_queued
    FROM public.branch_cn_ranges
    WHERE branch_id = v_branch.id
      AND status = 'pending'
      AND p_cn_no BETWEEN range_start AND range_end
    ORDER BY created_at ASC
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION
        'CN % is outside the active range %-% for branch %. It belongs to queued range %-% which activates only after the current range is used up.',
        p_cn_no,
        v_active_range.range_start,
        v_active_range.range_end,
        v_branch.code,
        v_queued.range_start,
        v_queued.range_end;
    END IF;

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

-- 7. Soft-delete reuse: rewind active OR exhausted range pointer so the freed
--    CN can be issued again. If the range was exhausted and no other active
--    range exists, revive it to active.
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
  v_range public.branch_cn_ranges;
  v_has_other_active BOOLEAN;
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

  -- Prefer the active range containing this CN; else an exhausted one.
  SELECT *
  INTO v_range
  FROM public.branch_cn_ranges
  WHERE branch_id = v_branch.id
    AND status IN ('active', 'exhausted')
    AND v_cn BETWEEN range_start AND range_end
  ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at DESC
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.branch_cn_ranges
    WHERE branch_id = v_branch.id
      AND status = 'active'
      AND id <> v_range.id
  ) INTO v_has_other_active;

  IF v_cn < v_range.next_cn_no OR v_range.status = 'exhausted' THEN
    IF v_range.status = 'exhausted' AND v_has_other_active THEN
      -- Another range is already active: leave history alone.
      -- The number is still free via live_consignment_cn_exists / unique index.
      RETURN;
    END IF;

    UPDATE public.branch_cn_ranges
    SET next_cn_no = LEAST(v_cn, next_cn_no),
        status = 'active'
    WHERE id = v_range.id;

    UPDATE public.branches
    SET next_cn_no = LEAST(v_cn, next_cn_no)
    WHERE id = v_branch.id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_cn_number_after_soft_delete(TEXT, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
