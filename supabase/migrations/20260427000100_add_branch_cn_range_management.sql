CREATE TABLE IF NOT EXISTS public.branch_cn_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    next_cn_no BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'inactive')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branch_cn_ranges_bounds_check CHECK (range_start <= range_end),
    CONSTRAINT branch_cn_ranges_next_cn_check CHECK (next_cn_no >= range_start AND next_cn_no <= (range_end + 1))
);

CREATE TABLE IF NOT EXISTS public.branch_cn_reserved_ranges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    range_start BIGINT NOT NULL,
    range_end BIGINT NOT NULL,
    reservation_type TEXT NOT NULL DEFAULT 'physical_copy' CHECK (reservation_type = 'physical_copy'),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT branch_cn_reserved_ranges_bounds_check CHECK (range_start <= range_end)
);

ALTER TABLE public.branch_cn_ranges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_cn_reserved_ranges ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_cn_ranges_no_overlap'
    ) THEN
        ALTER TABLE public.branch_cn_ranges
            ADD CONSTRAINT branch_cn_ranges_no_overlap
            EXCLUDE USING gist (
                int8range(range_start, range_end + 1, '[)') WITH &&
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'branch_cn_reserved_ranges_no_overlap'
    ) THEN
        ALTER TABLE public.branch_cn_reserved_ranges
            ADD CONSTRAINT branch_cn_reserved_ranges_no_overlap
            EXCLUDE USING gist (
                int8range(range_start, range_end + 1, '[)') WITH &&
            );
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_branch_cn_ranges_active_per_branch
    ON public.branch_cn_ranges(branch_id)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_branch_cn_ranges_branch_id
    ON public.branch_cn_ranges(branch_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_branch_cn_reserved_ranges_branch_id
    ON public.branch_cn_reserved_ranges(branch_id, created_at DESC);

DROP TRIGGER IF EXISTS set_branch_cn_ranges_updated_at ON public.branch_cn_ranges;
CREATE TRIGGER set_branch_cn_ranges_updated_at
    BEFORE UPDATE ON public.branch_cn_ranges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_branch_cn_reserved_ranges_updated_at ON public.branch_cn_reserved_ranges;
CREATE TRIGGER set_branch_cn_reserved_ranges_updated_at
    BEFORE UPDATE ON public.branch_cn_reserved_ranges
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS "Authenticated users can read branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Authenticated users can read branch CN ranges"
    ON public.branch_cn_ranges
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can insert branch CN ranges"
    ON public.branch_cn_ranges
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can update branch CN ranges"
    ON public.branch_cn_ranges
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete branch CN ranges" ON public.branch_cn_ranges;
CREATE POLICY "Admins can delete branch CN ranges"
    ON public.branch_cn_ranges
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can read branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Authenticated users can read branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR SELECT
    TO authenticated
    USING (true);

DROP POLICY IF EXISTS "Admins can insert branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can insert branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR INSERT
    TO authenticated
    WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can update branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR UPDATE
    TO authenticated
    USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete branch CN reserved ranges" ON public.branch_cn_reserved_ranges;
CREATE POLICY "Admins can delete branch CN reserved ranges"
    ON public.branch_cn_reserved_ranges
    FOR DELETE
    TO authenticated
    USING (public.is_admin(auth.uid()));

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
    v_range public.branch_cn_ranges;
    v_candidate BIGINT := p_candidate;
    v_reserved RECORD;
BEGIN
    SELECT *
    INTO v_range
    FROM public.branch_cn_ranges
    WHERE id = p_range_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'CN range % not found.', p_range_id;
    END IF;

    IF v_candidate < v_range.range_start THEN
        v_candidate := v_range.range_start;
    END IF;

    LOOP
        EXIT WHEN v_candidate > v_range.range_end;

        SELECT range_start, range_end
        INTO v_reserved
        FROM public.branch_cn_reserved_ranges
        WHERE branch_id = v_range.branch_id
          AND range_start <= v_candidate
          AND range_end >= v_candidate
        LIMIT 1;

        IF NOT FOUND THEN
            RETURN v_candidate;
        END IF;

        v_candidate := v_reserved.range_end + 1;
    END LOOP;

    RETURN v_candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_branch_cn_range(
    p_branch_id UUID,
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
    v_new_range public.branch_cn_ranges;
    v_normalized_next BIGINT;
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
    ) THEN
        RAISE EXCEPTION 'Branch % not found.', p_branch_id;
    END IF;

    UPDATE public.branch_cn_ranges
    SET status = CASE
        WHEN next_cn_no > range_end THEN 'exhausted'
        ELSE 'inactive'
    END
    WHERE branch_id = p_branch_id
      AND status = 'active';

    INSERT INTO public.branch_cn_ranges (
        branch_id,
        range_start,
        range_end,
        next_cn_no,
        status,
        note
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        p_range_start,
        'active',
        NULLIF(BTRIM(p_note), '')
    )
    RETURNING *
    INTO v_new_range;

    v_normalized_next := public.next_available_branch_cn(v_new_range.id, v_new_range.next_cn_no);

    UPDATE public.branch_cn_ranges
    SET next_cn_no = v_normalized_next,
        status = CASE
            WHEN v_normalized_next > range_end THEN 'exhausted'
            ELSE 'active'
        END
    WHERE id = v_new_range.id
    RETURNING *
    INTO v_new_range;

    UPDATE public.branches
    SET next_cn_no = v_new_range.next_cn_no
    WHERE id = p_branch_id;

    RETURN v_new_range;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'CN range overlaps an existing branch-assigned range.';
END;
$$;

CREATE OR REPLACE FUNCTION public.create_branch_cn_reserved_range(
    p_branch_id UUID,
    p_range_start BIGINT,
    p_range_end BIGINT,
    p_note TEXT DEFAULT NULL
)
RETURNS public.branch_cn_reserved_ranges
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_reserved public.branch_cn_reserved_ranges;
    v_active_range public.branch_cn_ranges;
    v_normalized_next BIGINT;
BEGIN
    IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
        RAISE EXCEPTION 'Only admins can manage physical CN reservations.';
    END IF;

    IF p_range_start > p_range_end THEN
        RAISE EXCEPTION 'Range start must be less than or equal to range end.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.branch_cn_ranges
        WHERE branch_id = p_branch_id
          AND p_range_start >= range_start
          AND p_range_end <= range_end
    ) THEN
        RAISE EXCEPTION 'Physical CN range must stay inside an existing CN range assigned to this branch.';
    END IF;

    INSERT INTO public.branch_cn_reserved_ranges (
        branch_id,
        range_start,
        range_end,
        note
    )
    VALUES (
        p_branch_id,
        p_range_start,
        p_range_end,
        NULLIF(BTRIM(p_note), '')
    )
    RETURNING *
    INTO v_reserved;

    SELECT *
    INTO v_active_range
    FROM public.branch_cn_ranges
    WHERE branch_id = p_branch_id
      AND status = 'active'
    LIMIT 1;

    IF FOUND THEN
        v_normalized_next := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

        UPDATE public.branch_cn_ranges
        SET next_cn_no = v_normalized_next,
            status = CASE
                WHEN v_normalized_next > range_end THEN 'exhausted'
                ELSE 'active'
            END
        WHERE id = v_active_range.id
        RETURNING *
        INTO v_active_range;

        UPDATE public.branches
        SET next_cn_no = v_active_range.next_cn_no
        WHERE id = p_branch_id;
    END IF;

    RETURN v_reserved;
EXCEPTION
    WHEN exclusion_violation THEN
        RAISE EXCEPTION 'Physical CN reservation overlaps an existing physical reservation.';
END;
$$;

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

    SELECT r.*
    INTO v_active_range
    FROM public.branch_cn_ranges r
    WHERE r.branch_id = v_branch.id
      AND r.status = 'active'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No active CN range configured for branch %.', v_branch.code;
    END IF;

    v_current := public.next_available_branch_cn(v_active_range.id, v_active_range.next_cn_no);

    IF v_current > v_active_range.range_end THEN
        UPDATE public.branch_cn_ranges
        SET next_cn_no = v_current,
            status = 'exhausted'
        WHERE id = v_active_range.id
        RETURNING *
        INTO v_active_range;

        UPDATE public.branches
        SET next_cn_no = v_current
        WHERE id = v_branch.id;

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

    UPDATE public.branches
    SET next_cn_no = v_next
    WHERE id = v_branch.id;

    consumed_cn_no := p_cn_no;
    next_cn_no := v_active_range.next_cn_no;
    range_start := v_active_range.range_start;
    range_end := v_active_range.range_end;
    status := v_active_range.status;
    RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_available_branch_cn(UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_branch_cn_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_branch_cn_reserved_range(UUID, BIGINT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.advance_branch_cn_sequence(TEXT, BIGINT) TO authenticated;
