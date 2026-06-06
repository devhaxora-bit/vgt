-- ============================================================
-- Remove physical CN reservation system entirely
-- ============================================================

-- Drop the physical-reservation RPC first (depends on the table)
DROP FUNCTION IF EXISTS public.create_branch_cn_reserved_range(UUID, BIGINT, BIGINT, TEXT);

-- Drop the table (policies, triggers, indexes go with it)
DROP TABLE IF EXISTS public.branch_cn_reserved_ranges;

-- Rewrite next_available_branch_cn: skip only existing consignment numbers
CREATE OR REPLACE FUNCTION public.next_available_branch_cn(
    p_range_id UUID,
    p_candidate BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
    v_range     public.branch_cn_ranges;
    v_candidate BIGINT := p_candidate;
    v_cn_exists BOOLEAN;
BEGIN
    SELECT *
    INTO   v_range
    FROM   public.branch_cn_ranges
    WHERE  id = p_range_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CN range % not found.', p_range_id;
    END IF;

    IF v_candidate < v_range.range_start THEN
        v_candidate := v_range.range_start;
    END IF;

    LOOP
        EXIT WHEN v_candidate > v_range.range_end;

        SELECT EXISTS(
            SELECT 1
            FROM   public.consignments
            WHERE  cn_no ~ '^\d+$'
              AND  cn_no::bigint = v_candidate
        ) INTO v_cn_exists;

        IF NOT v_cn_exists THEN
            RETURN v_candidate;
        END IF;

        v_candidate := v_candidate + 1;
    END LOOP;

    RETURN v_candidate;
END;
$$;

-- Rewrite create_branch_cn_range: skip only existing consignment numbers
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
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can manage branch CN ranges.';
    END IF;

    IF p_range_start > p_range_end THEN
        RAISE EXCEPTION 'Range start must be less than or equal to range end.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id) THEN
        RAISE EXCEPTION 'Branch % not found.', p_branch_id;
    END IF;

    UPDATE public.branch_cn_ranges
    SET status = CASE
                     WHEN next_cn_no > range_end THEN 'exhausted'
                     ELSE 'inactive'
                 END
    WHERE branch_id = p_branch_id
      AND status    = 'active';

    v_candidate := p_range_start;
    LOOP
        EXIT WHEN v_candidate > p_range_end;

        SELECT EXISTS(
            SELECT 1
            FROM   public.consignments
            WHERE  cn_no ~ '^\d+$'
              AND  cn_no::bigint = v_candidate
        ) INTO v_cn_exists;

        IF NOT v_cn_exists THEN
            EXIT;
        END IF;

        v_candidate := v_candidate + 1;
    END LOOP;

    INSERT INTO public.branch_cn_ranges (
        branch_id, range_start, range_end, next_cn_no, status, note
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        v_candidate,
        CASE WHEN v_candidate > p_range_end THEN 'exhausted' ELSE 'active' END,
        NULLIF(BTRIM(p_note), '')
    )
    RETURNING *
    INTO v_new_range;

    UPDATE public.branches
    SET next_cn_no = v_new_range.next_cn_no
    WHERE id = p_branch_id;

    RETURN v_new_range;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION
            'CN range % – % overlaps a range already assigned to another branch. Each CN block can only be issued to one branch.',
            p_range_start, p_range_end;
END;
$$;

NOTIFY pgrst, 'reload schema';
