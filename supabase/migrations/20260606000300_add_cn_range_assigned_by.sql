-- Track who issued each CN range assignment
ALTER TABLE public.branch_cn_ranges
    ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branch_cn_ranges_assigned_by
    ON public.branch_cn_ranges(assigned_by);

-- Store assigner when a new CN range is issued
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
        branch_id, range_start, range_end, next_cn_no, status, note, assigned_by
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        v_candidate,
        CASE WHEN v_candidate > p_range_end THEN 'exhausted' ELSE 'active' END,
        NULLIF(BTRIM(p_note), ''),
        auth.uid()
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
