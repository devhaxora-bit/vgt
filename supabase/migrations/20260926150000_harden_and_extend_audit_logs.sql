-- Harden ledger_audit_logs (append-only) and extend coverage to master data:
-- parties, brokers, vehicles, users. Improve actor attribution when auth.uid()
-- is null (service role) by falling back to row attribution columns.
-- Also add auth_login_attempts for failed/successful login proof.

-- ---------------------------------------------------------------------------
-- 1) Actor helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_set_audit_actor(p_actor_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.actor_id', COALESCE(p_actor_id::text, ''), true);
END;
$$;

COMMENT ON FUNCTION public.fn_set_audit_actor(uuid) IS
  'Sets transaction-local app.actor_id for audit triggers when auth.uid() is null (e.g. service role). Must run in the same DB transaction as the mutation.';

GRANT EXECUTE ON FUNCTION public.fn_set_audit_actor(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.fn_resolve_audit_actor(p_old jsonb, p_new jsonb)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    auth.uid(),
    NULLIF(current_setting('app.actor_id', true), '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'updated_by', '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'cancelled_by', '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'reversed_by', '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'deleted_by', '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'assigned_by', '')::uuid,
    NULLIF(COALESCE(p_new, '{}'::jsonb)->>'created_by', '')::uuid,
    NULLIF(COALESCE(p_old, '{}'::jsonb)->>'updated_by', '')::uuid,
    NULLIF(COALESCE(p_old, '{}'::jsonb)->>'cancelled_by', '')::uuid,
    NULLIF(COALESCE(p_old, '{}'::jsonb)->>'reversed_by', '')::uuid,
    NULLIF(COALESCE(p_old, '{}'::jsonb)->>'deleted_by', '')::uuid,
    NULLIF(COALESCE(p_old, '{}'::jsonb)->>'created_by', '')::uuid
  );
$$;

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
    'user'
  ));

COMMENT ON TABLE public.ledger_audit_logs IS
  'Append-only history of financial and master-data changes. Rows from the same database transaction share txid.';

-- ---------------------------------------------------------------------------
-- 3) Replace audit trigger function (actor + master entity refs)
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
    v_entity_id::text
  );

  v_old_party := COALESCE((v_old->>'party_id')::uuid, (v_old->>'billing_party_id')::uuid);
  v_new_party := COALESCE((v_new->>'party_id')::uuid, (v_new->>'billing_party_id')::uuid);
  v_old_broker := (v_old->>'broker_id')::uuid;
  v_new_broker := (v_new->>'broker_id')::uuid;

  -- For party entity itself, index by party id for admin filters
  IF v_entity_type = 'party' THEN
    v_old_party := COALESCE(v_old_party, (v_old->>'id')::uuid);
    v_new_party := COALESCE(v_new_party, (v_new->>'id')::uuid, v_entity_id);
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
-- 4) Master-data triggers
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_ledger_audit_parties ON public.parties;
CREATE TRIGGER trg_ledger_audit_parties
  AFTER INSERT OR UPDATE OR DELETE ON public.parties
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('party');

DROP TRIGGER IF EXISTS trg_ledger_audit_brokers ON public.brokers;
CREATE TRIGGER trg_ledger_audit_brokers
  AFTER INSERT OR UPDATE OR DELETE ON public.brokers
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('broker');

DROP TRIGGER IF EXISTS trg_ledger_audit_vehicles ON public.vehicles;
CREATE TRIGGER trg_ledger_audit_vehicles
  AFTER INSERT OR UPDATE OR DELETE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('vehicle');

DROP TRIGGER IF EXISTS trg_ledger_audit_users ON public.users;
CREATE TRIGGER trg_ledger_audit_users
  AFTER INSERT OR UPDATE OR DELETE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('user');

-- ---------------------------------------------------------------------------
-- 5) Append-only enforcement
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.fn_ledger_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Intentional retention/purge jobs may set app.allow_audit_purge=true for this txn.
  IF TG_OP = 'DELETE'
     AND lower(COALESCE(current_setting('app.allow_audit_purge', true), '')) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'ledger_audit_logs is append-only (no % allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_ledger_audit_immutable ON public.ledger_audit_logs;
CREATE TRIGGER trg_ledger_audit_immutable
  BEFORE UPDATE OR DELETE ON public.ledger_audit_logs
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_immutable();

REVOKE INSERT, UPDATE, DELETE ON public.ledger_audit_logs FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_audit_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_audit_logs FROM authenticated;
-- service_role may still delete when app.allow_audit_purge is set (scripts only).
GRANT SELECT ON public.ledger_audit_logs TO authenticated;
GRANT SELECT ON public.ledger_audit_logs TO service_role;

CREATE OR REPLACE FUNCTION public.fn_allow_audit_purge()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM set_config('app.allow_audit_purge', 'true', true);
END;
$$;

REVOKE ALL ON FUNCTION public.fn_allow_audit_purge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_allow_audit_purge() TO service_role;

-- Single-transaction purge so append-only trigger sees app.allow_audit_purge.
CREATE OR REPLACE FUNCTION public.fn_purge_audit_log_ids(p_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN 0;
  END IF;

  PERFORM set_config('app.allow_audit_purge', 'true', true);
  DELETE FROM public.ledger_audit_logs WHERE id = ANY (p_ids);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.fn_purge_audit_log_ids(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_purge_audit_log_ids(uuid[]) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Auth login attempts (failed + successful proof)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  employee_code   text,
  role            text,
  success         boolean NOT NULL DEFAULT false,
  failure_reason  text,
  user_id         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ip_address      inet,
  user_agent      text
);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_occurred_at
  ON public.auth_login_attempts (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_employee_code
  ON public.auth_login_attempts (employee_code, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_user_id
  ON public.auth_login_attempts (user_id, occurred_at DESC)
  WHERE user_id IS NOT NULL;

COMMENT ON TABLE public.auth_login_attempts IS
  'Append-only login attempt log (success and failure) for client proof of access.';

ALTER TABLE public.auth_login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_login_attempts_select_admin ON public.auth_login_attempts;
CREATE POLICY auth_login_attempts_select_admin
  ON public.auth_login_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- Inserts come from service role / SECURITY DEFINER during login; no client INSERT.
REVOKE INSERT, UPDATE, DELETE ON public.auth_login_attempts FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.auth_login_attempts FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.auth_login_attempts FROM authenticated;
GRANT SELECT ON public.auth_login_attempts TO authenticated;
GRANT SELECT, INSERT ON public.auth_login_attempts TO service_role;

CREATE OR REPLACE FUNCTION public.fn_auth_login_attempts_immutable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'auth_login_attempts is append-only (no % allowed)', TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_login_attempts_immutable ON public.auth_login_attempts;
CREATE TRIGGER trg_auth_login_attempts_immutable
  BEFORE UPDATE OR DELETE ON public.auth_login_attempts
  FOR EACH ROW EXECUTE FUNCTION public.fn_auth_login_attempts_immutable();

NOTIFY pgrst, 'reload schema';
