-- Phase C: audit coverage for branches, CN ranges, party_branches.
-- Omit next_cn_no from CN-range diffs so routine CN allocation does not flood logs.

-- ---------------------------------------------------------------------------
-- 1) party_branches: add surrogate uuid for audit entity_id
-- ---------------------------------------------------------------------------

ALTER TABLE public.party_branches
  ADD COLUMN IF NOT EXISTS id uuid;

UPDATE public.party_branches
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.party_branches
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

ALTER TABLE public.party_branches
  ALTER COLUMN id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_party_branches_id
  ON public.party_branches (id);

-- ---------------------------------------------------------------------------
-- 2) Widen entity_type CHECK
-- ---------------------------------------------------------------------------

ALTER TABLE public.ledger_audit_logs
  DROP CONSTRAINT IF EXISTS ledger_audit_logs_entity_type_check;

ALTER TABLE public.ledger_audit_logs
  ADD CONSTRAINT ledger_audit_logs_entity_type_check
  CHECK (entity_type IN (
    'bill',
    'payment',
    'consignment',
    'challan',
    'challan_bill',
    'challan_payment',
    'party',
    'broker',
    'vehicle',
    'user',
    'branch',
    'cn_range',
    'party_branch'
  ));

COMMENT ON TABLE public.ledger_audit_logs IS
  'Append-only history of financial, master-data, and config changes. Rows from the same database transaction share txid.';

-- ---------------------------------------------------------------------------
-- 3) Replace audit trigger function
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ledger_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_omit text[] := ARRAY['updated_at'];
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_action text;
  v_entity_id uuid;
  v_entity_ref text;
  v_old_party uuid;
  v_new_party uuid;
  v_old_broker uuid;
  v_new_broker uuid;
  v_actor uuid;
BEGIN
  IF v_entity_type = 'consignment' THEN
    v_omit := v_omit || ARRAY['packages'];
  END IF;

  -- CN allocation advances next_cn_no frequently; keep proof of range
  -- assign / status / bound / note edits without flooding the log.
  IF v_entity_type = 'cn_range' THEN
    v_omit := v_omit || ARRAY['next_cn_no'];
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_new := public.fn_jsonb_omit_keys(to_jsonb(NEW), v_omit);
    v_changed := public.fn_jsonb_changed_keys(NULL, v_new);
    v_action := 'insert';
    v_entity_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_old := public.fn_jsonb_omit_keys(to_jsonb(OLD), v_omit);
    v_changed := public.fn_jsonb_changed_keys(v_old, NULL);
    v_action := 'delete';
    v_entity_id := OLD.id;
  ELSE
    v_old := public.fn_jsonb_omit_keys(to_jsonb(OLD), v_omit);
    v_new := public.fn_jsonb_omit_keys(to_jsonb(NEW), v_omit);
    v_changed := public.fn_jsonb_changed_keys(v_old, v_new);

    IF COALESCE(cardinality(v_changed), 0) = 0 THEN
      RETURN NULL;
    END IF;

    v_action := 'update';

    IF COALESCE(v_old->>'status', '') IS DISTINCT FROM COALESCE(v_new->>'status', '') THEN
      IF v_new->>'status' = 'CANCELLED' THEN
        v_action := 'cancel';
      ELSIF v_new->>'status' = 'REVERSED' THEN
        v_action := 'reverse';
      END IF;
    END IF;

    IF (v_old->>'party_id') IS DISTINCT FROM (v_new->>'party_id')
       OR (v_old->>'billing_party_id') IS DISTINCT FROM (v_new->>'billing_party_id')
       OR (v_old->>'broker_id') IS DISTINCT FROM (v_new->>'broker_id')
       OR (v_old->>'party_ledger_account_id') IS DISTINCT FROM (v_new->>'party_ledger_account_id')
       OR (v_old->>'broker_ledger_account_id') IS DISTINCT FROM (v_new->>'broker_ledger_account_id') THEN
      v_action := 'reassign';
    END IF;

    v_entity_id := NEW.id;
  END IF;

  v_entity_ref := COALESCE(
    v_new->>'bill_ref_no',
    v_old->>'bill_ref_no',
    v_new->>'cn_no',
    v_old->>'cn_no',
    v_new->>'challan_no',
    v_old->>'challan_no',
    v_new->>'reference_no',
    v_old->>'reference_no',
    v_new->>'vehicle_no',
    v_old->>'vehicle_no',
    v_new->>'employee_code',
    v_old->>'employee_code',
    v_new->>'code',
    v_old->>'code',
    v_new->>'full_name',
    v_old->>'full_name',
    v_new->>'name',
    v_old->>'name',
    CASE
      WHEN v_entity_type = 'cn_range' THEN
        format(
          '%s-%s',
          COALESCE(v_new->>'range_start', v_old->>'range_start', '?'),
          COALESCE(v_new->>'range_end', v_old->>'range_end', '?')
        )
      WHEN v_entity_type = 'party_branch' THEN
        format(
          '%s@%s',
          left(COALESCE(v_new->>'party_id', v_old->>'party_id', '?'), 8),
          COALESCE(v_new->>'branch_code', v_old->>'branch_code', '?')
        )
      ELSE NULL
    END,
    v_entity_id::text
  );

  v_old_party := COALESCE((v_old->>'party_id')::uuid, (v_old->>'billing_party_id')::uuid);
  v_new_party := COALESCE((v_new->>'party_id')::uuid, (v_new->>'billing_party_id')::uuid);
  v_old_broker := (v_old->>'broker_id')::uuid;
  v_new_broker := (v_new->>'broker_id')::uuid;

  IF v_entity_type = 'party' THEN
    v_old_party := COALESCE(v_old_party, (v_old->>'id')::uuid);
    v_new_party := COALESCE(v_new_party, (v_new->>'id')::uuid, v_entity_id);
  END IF;

  IF v_entity_type = 'party_branch' THEN
    v_old_party := COALESCE(v_old_party, (v_old->>'party_id')::uuid);
    v_new_party := COALESCE(v_new_party, (v_new->>'party_id')::uuid);
  END IF;

  IF v_entity_type = 'broker' THEN
    v_old_broker := COALESCE(v_old_broker, (v_old->>'id')::uuid);
    v_new_broker := COALESCE(v_new_broker, (v_new->>'id')::uuid, v_entity_id);
  END IF;

  v_actor := public.fn_resolve_audit_actor(v_old, v_new);

  INSERT INTO public.ledger_audit_logs (
    actor_id,
    entity_type,
    entity_id,
    entity_ref,
    action,
    old_party_id,
    new_party_id,
    old_broker_id,
    new_broker_id,
    changed_fields,
    old_data,
    new_data
  ) VALUES (
    v_actor,
    v_entity_type,
    v_entity_id,
    v_entity_ref,
    v_action,
    v_old_party,
    v_new_party,
    v_old_broker,
    v_new_broker,
    COALESCE(v_changed, ARRAY[]::text[]),
    v_old,
    v_new
  );

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_ledger_audit_branches ON public.branches;
CREATE TRIGGER trg_ledger_audit_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('branch');

DROP TRIGGER IF EXISTS trg_ledger_audit_cn_ranges ON public.branch_cn_ranges;
CREATE TRIGGER trg_ledger_audit_cn_ranges
  AFTER INSERT OR UPDATE OR DELETE ON public.branch_cn_ranges
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('cn_range');

DROP TRIGGER IF EXISTS trg_ledger_audit_party_branches ON public.party_branches;
CREATE TRIGGER trg_ledger_audit_party_branches
  AFTER INSERT OR UPDATE OR DELETE ON public.party_branches
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('party_branch');

NOTIFY pgrst, 'reload schema';
