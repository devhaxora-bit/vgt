-- Immutable audit log for bills, payments, consignments, and challans.
-- Triggers record who changed what, with old/new snapshots and changed fields.

CREATE TABLE IF NOT EXISTS public.ledger_audit_logs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at     timestamptz NOT NULL DEFAULT now(),
  txid            bigint NOT NULL DEFAULT txid_current(),
  actor_id        uuid,
  entity_type     text NOT NULL
                    CHECK (entity_type IN (
                      'bill',
                      'payment',
                      'consignment',
                      'challan',
                      'challan_bill',
                      'challan_payment'
                    )),
  entity_id       uuid NOT NULL,
  entity_ref      text,
  action          text NOT NULL
                    CHECK (action IN ('insert', 'update', 'delete', 'reassign', 'cancel', 'reverse')),
  old_party_id    uuid,
  new_party_id    uuid,
  old_broker_id   uuid,
  new_broker_id   uuid,
  changed_fields  text[] NOT NULL DEFAULT ARRAY[]::text[],
  old_data        jsonb,
  new_data        jsonb
);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_occurred_at
  ON public.ledger_audit_logs (occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_entity
  ON public.ledger_audit_logs (entity_type, entity_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_txid
  ON public.ledger_audit_logs (txid);

CREATE INDEX IF NOT EXISTS idx_ledger_audit_old_party
  ON public.ledger_audit_logs (old_party_id, occurred_at DESC)
  WHERE old_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_audit_new_party
  ON public.ledger_audit_logs (new_party_id, occurred_at DESC)
  WHERE new_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_audit_old_broker
  ON public.ledger_audit_logs (old_broker_id, occurred_at DESC)
  WHERE old_broker_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_audit_new_broker
  ON public.ledger_audit_logs (new_broker_id, occurred_at DESC)
  WHERE new_broker_id IS NOT NULL;

COMMENT ON TABLE public.ledger_audit_logs IS
  'Append-only history of bill, payment, consignment, and challan changes. Rows from the same database transaction share txid (for example a bill reassignment that also moves CNs and payments).';

CREATE OR REPLACE FUNCTION public.fn_jsonb_omit_keys(p_data jsonb, p_keys text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(p_data, '{}'::jsonb) - COALESCE(p_keys, ARRAY[]::text[]);
$$;

CREATE OR REPLACE FUNCTION public.fn_jsonb_changed_keys(p_old jsonb, p_new jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT key
      FROM (
        SELECT DISTINCT key
        FROM (
          SELECT jsonb_object_keys(COALESCE(p_old, '{}'::jsonb)) AS key
          UNION
          SELECT jsonb_object_keys(COALESCE(p_new, '{}'::jsonb)) AS key
        ) keys
      ) distinct_keys
      WHERE (COALESCE(p_old, '{}'::jsonb) -> key) IS DISTINCT FROM (COALESCE(p_new, '{}'::jsonb) -> key)
      ORDER BY key
    ),
    ARRAY[]::text[]
  );
$$;

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
    v_entity_id::text
  );

  v_old_party := COALESCE((v_old->>'party_id')::uuid, (v_old->>'billing_party_id')::uuid);
  v_new_party := COALESCE((v_new->>'party_id')::uuid, (v_new->>'billing_party_id')::uuid);
  v_old_broker := (v_old->>'broker_id')::uuid;
  v_new_broker := (v_new->>'broker_id')::uuid;

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
    auth.uid(),
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

DROP TRIGGER IF EXISTS trg_ledger_audit_bills ON public.party_billing_records;
CREATE TRIGGER trg_ledger_audit_bills
  AFTER INSERT OR UPDATE OR DELETE ON public.party_billing_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('bill');

DROP TRIGGER IF EXISTS trg_ledger_audit_payments ON public.party_payment_receipts;
CREATE TRIGGER trg_ledger_audit_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.party_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('payment');

DROP TRIGGER IF EXISTS trg_ledger_audit_consignments ON public.consignments;
CREATE TRIGGER trg_ledger_audit_consignments
  AFTER INSERT OR UPDATE OR DELETE ON public.consignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('consignment');

DROP TRIGGER IF EXISTS trg_ledger_audit_challans ON public.challans;
CREATE TRIGGER trg_ledger_audit_challans
  AFTER INSERT OR UPDATE OR DELETE ON public.challans
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('challan');

DROP TRIGGER IF EXISTS trg_ledger_audit_challan_bills ON public.broker_challan_billing_records;
CREATE TRIGGER trg_ledger_audit_challan_bills
  AFTER INSERT OR UPDATE OR DELETE ON public.broker_challan_billing_records
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('challan_bill');

DROP TRIGGER IF EXISTS trg_ledger_audit_challan_payments ON public.broker_challan_payment_receipts;
CREATE TRIGGER trg_ledger_audit_challan_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.broker_challan_payment_receipts
  FOR EACH ROW EXECUTE FUNCTION public.fn_ledger_audit_row('challan_payment');

ALTER TABLE public.ledger_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ledger_audit_select_admin ON public.ledger_audit_logs;
CREATE POLICY ledger_audit_select_admin
  ON public.ledger_audit_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

GRANT SELECT ON public.ledger_audit_logs TO authenticated;

NOTIFY pgrst, 'reload schema';
