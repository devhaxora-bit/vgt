-- Soft-delete consignments (tombstone keeps data; frees cn_no for reuse)
-- Main/global admins only at API layer.

ALTER TABLE public.consignments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID NULL REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS delete_reason TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_consignments_deleted_at
  ON public.consignments (deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_consignments_live_booking_branch
  ON public.consignments (booking_branch)
  WHERE deleted_at IS NULL;

-- Replace full unique with live-only unique so soft-deleted CNs free the number
ALTER TABLE public.consignments
  DROP CONSTRAINT IF EXISTS consignments_cn_no_key;

DROP INDEX IF EXISTS public.consignments_cn_no_key;
DROP INDEX IF EXISTS public.consignments_cn_no_live_uidx;

CREATE UNIQUE INDEX consignments_cn_no_live_uidx
  ON public.consignments (cn_no)
  WHERE deleted_at IS NULL;

-- Live CN number occupancy (excludes soft-deleted)
CREATE OR REPLACE FUNCTION public.live_consignment_cn_exists(p_cn BIGINT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.consignments c
    WHERE c.deleted_at IS NULL
      AND c.cn_no ~ '^\d+$'
      AND c.cn_no::bigint = p_cn
  );
$$;

GRANT EXECUTE ON FUNCTION public.live_consignment_cn_exists(BIGINT) TO authenticated;

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
    WHERE c.deleted_at IS NULL
      AND c.cn_no ~ '^\d+$'
      AND c.cn_no::bigint BETWEEN p_range_start AND p_range_end
  );
$$;

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

    IF NOT public.live_consignment_cn_exists(v_candidate) THEN
      RETURN v_candidate;
    END IF;

    v_candidate := v_candidate + 1;
  END LOOP;

  RETURN v_candidate;
END;
$$;

-- After soft-delete, rewind active range next_cn so the number can be re-issued
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

  SELECT *
  INTO v_range
  FROM public.branch_cn_ranges
  WHERE branch_id = v_branch.id
    AND status = 'active'
    AND v_cn BETWEEN range_start AND range_end
  FOR UPDATE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF v_cn < v_range.next_cn_no THEN
    UPDATE public.branch_cn_ranges
    SET next_cn_no = v_cn,
        status = 'active'
    WHERE id = v_range.id;

    UPDATE public.branches
    SET next_cn_no = v_cn
    WHERE id = v_branch.id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_cn_number_after_soft_delete(TEXT, TEXT) TO authenticated;

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
    EXIT WHEN NOT public.live_consignment_cn_exists(v_candidate);
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
    EXIT WHEN NOT public.live_consignment_cn_exists(v_candidate);
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

-- Exclude soft-deleted CNs from party ledger summary
DROP VIEW IF EXISTS public.vw_party_ledger_summary;

CREATE VIEW public.vw_party_ledger_summary AS
SELECT
  p.id                                    AS party_id,
  p.name                                  AS party_name,
  p.code                                  AS party_code,
  p.phone,
  p.branch_code,
  p.is_active                             AS party_active,
  pla.id                                  AS ledger_account_id,
  pla.opening_balance,
  pla.credit_limit,
  pla.credit_days,
  pla.is_active                           AS ledger_active,
  COALESCE(cns_agg.total_freight, 0)      AS total_cns_amount,
  COALESCE(cns_agg.cns_count, 0)          AS total_cns_count,
  COALESCE(bill_agg.total_billed, 0)      AS total_billed,
  COALESCE(pay_agg.total_paid, 0)         AS total_paid,
  GREATEST(
    COALESCE(cns_agg.total_freight, 0) - COALESCE(bill_agg.total_billed, 0),
    0
  )                                       AS unbilled_amount,
  GREATEST(
    COALESCE(bill_agg.total_billed, 0) - COALESCE(cns_agg.total_freight, 0),
    0
  )                                       AS overbilled_amount,
  pla.opening_balance
    + COALESCE(bill_agg.total_billed, 0)
    - COALESCE(pay_agg.total_paid, 0)     AS outstanding
FROM public.parties p
JOIN public.party_ledger_accounts pla ON pla.party_id = p.id
LEFT JOIN LATERAL (
  SELECT
    SUM(c.total_freight) AS total_freight,
    COUNT(c.id)          AS cns_count
  FROM public.consignments c
  WHERE c.billing_party_id = p.id
    AND c.cancel_cn = false
    AND c.deleted_at IS NULL
) cns_agg ON true
LEFT JOIN LATERAL (
  SELECT
    SUM(pbr.amount) AS total_billed
  FROM public.party_billing_records pbr
  WHERE pbr.party_id = p.id
    AND pbr.status = 'ACTIVE'
) bill_agg ON true
LEFT JOIN LATERAL (
  SELECT SUM(ppr.amount) AS total_paid
  FROM public.party_payment_receipts ppr
  WHERE ppr.party_id = p.id
    AND ppr.status = 'ACTIVE'
) pay_agg ON true
WHERE
  p.is_active = true
  OR pla.opening_balance <> 0
  OR COALESCE(cns_agg.total_freight, 0) <> 0
  OR COALESCE(bill_agg.total_billed, 0) <> 0
  OR COALESCE(pay_agg.total_paid, 0) <> 0;

-- Parties SELECT policy: live CNs only for "has consignments" visibility
DROP POLICY IF EXISTS "parties_select_branch" ON public.parties;

CREATE POLICY "parties_select_branch"
ON public.parties
FOR SELECT TO authenticated
USING (
  public.can_access_branch(branch_code)
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
