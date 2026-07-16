-- ============================================================
-- When a branch is deactivated, release its CN ranges so another
-- active branch can be issued the same numeric block.
-- Overlap is enforced only among active ranges.
-- ============================================================

-- 1. Only active ranges may overlap-check against each other
ALTER TABLE public.branch_cn_ranges
  DROP CONSTRAINT IF EXISTS branch_cn_ranges_no_overlap;

ALTER TABLE public.branch_cn_ranges
  ADD CONSTRAINT branch_cn_ranges_no_overlap
  EXCLUDE USING gist (
    int8range(range_start, range_end + 1, '[)') WITH &&
  ) WHERE (status = 'active');

-- 2. Deactivate CN ranges when branch becomes inactive
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
      AND status = 'active';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deactivate_branch_cn_ranges_on_branch_inactive ON public.branches;

CREATE TRIGGER trg_deactivate_branch_cn_ranges_on_branch_inactive
  AFTER UPDATE OF is_active ON public.branches
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_deactivate_branch_cn_ranges_on_branch_inactive();

-- 3. Backfill: inactive branches must not hold active CN ranges
UPDATE public.branch_cn_ranges bcr
SET status = CASE
  WHEN bcr.next_cn_no > bcr.range_end THEN 'exhausted'
  ELSE 'inactive'
END
WHERE bcr.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM public.branches b
    WHERE b.id = bcr.branch_id
      AND COALESCE(b.is_active, true) = false
  );

NOTIFY pgrst, 'reload schema';
