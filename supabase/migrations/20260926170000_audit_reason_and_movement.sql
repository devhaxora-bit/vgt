-- Store explicit reason + movement summary on every audit event.
-- Add change_reason on financial/config rows so edits carry a required reason
-- into the append-only audit trail (before/after snapshots already exist).

-- ---------------------------------------------------------------------------
-- 1) Audit columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.ledger_audit_logs
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS movement_summary text;

COMMENT ON COLUMN public.ledger_audit_logs.reason IS
  'Human reason for the change (cancel/reverse/delete/edit/reassign).';
COMMENT ON COLUMN public.ledger_audit_logs.movement_summary IS
  'Readable movement detail (party/broker/CN coverage changes).';

CREATE INDEX IF NOT EXISTS idx_ledger_audit_reason
  ON public.ledger_audit_logs (occurred_at DESC)
  WHERE reason IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) change_reason on mutable financial tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.party_billing_records
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.party_payment_receipts
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.broker_challan_billing_records
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.broker_challan_payment_receipts
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.challans
  ADD COLUMN IF NOT EXISTS change_reason text;

ALTER TABLE public.consignments
  ADD COLUMN IF NOT EXISTS change_reason text;

-- ---------------------------------------------------------------------------
-- 3) Trigger: extract reason + movement into audit row
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
  v_reason text;
  v_movement text;
  v_parts text[] := ARRAY[]::text[];
BEGIN
  IF v_entity_type = 'consignment' THEN
    v_omit := v_omit || ARRAY['packages'];
  END IF;

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

  -- Prefer explicit business reasons; fall back to change_reason on edits.
  v_reason := NULLIF(trim(COALESCE(
    v_new->>'cancel_reason',
    v_old->>'cancel_reason',
    v_new->>'reversal_reason',
    v_old->>'reversal_reason',
    v_new->>'delete_reason',
    v_old->>'delete_reason',
    v_new->>'change_reason',
    v_old->>'change_reason',
    ''
  )), '');

  IF v_old_party IS DISTINCT FROM v_new_party AND (v_old_party IS NOT NULL OR v_new_party IS NOT NULL) THEN
    v_parts := array_append(
      v_parts,
      format('party %s → %s', COALESCE(v_old_party::text, '—'), COALESCE(v_new_party::text, '—'))
    );
  END IF;

  IF v_old_broker IS DISTINCT FROM v_new_broker AND (v_old_broker IS NOT NULL OR v_new_broker IS NOT NULL) THEN
    v_parts := array_append(
      v_parts,
      format('broker %s → %s', COALESCE(v_old_broker::text, '—'), COALESCE(v_new_broker::text, '—'))
    );
  END IF;

  IF (v_old->>'covered_cn_nos') IS DISTINCT FROM (v_new->>'covered_cn_nos') THEN
    v_parts := array_append(v_parts, 'covered CNs changed');
  END IF;

  IF (v_old->>'linked_cn_nos') IS DISTINCT FROM (v_new->>'linked_cn_nos') THEN
    v_parts := array_append(v_parts, 'linked CNs changed');
  END IF;

  IF (v_old->>'related_billing_record_ids') IS DISTINCT FROM (v_new->>'related_billing_record_ids')
     OR (v_old->>'bill_allocations') IS DISTINCT FROM (v_new->>'bill_allocations') THEN
    v_parts := array_append(v_parts, 'bill allocation / settlement changed');
  END IF;

  IF (v_old->>'amount') IS DISTINCT FROM (v_new->>'amount') THEN
    v_parts := array_append(
      v_parts,
      format('amount %s → %s', COALESCE(v_old->>'amount', '—'), COALESCE(v_new->>'amount', '—'))
    );
  END IF;

  IF (v_old->>'status') IS DISTINCT FROM (v_new->>'status') THEN
    v_parts := array_append(
      v_parts,
      format('status %s → %s', COALESCE(v_old->>'status', '—'), COALESCE(v_new->>'status', '—'))
    );
  END IF;

  IF (v_old->>'branch_code') IS DISTINCT FROM (v_new->>'branch_code') THEN
    v_parts := array_append(
      v_parts,
      format('branch %s → %s', COALESCE(v_old->>'branch_code', '—'), COALESCE(v_new->>'branch_code', '—'))
    );
  END IF;

  IF cardinality(v_parts) > 0 THEN
    v_movement := array_to_string(v_parts, '; ');
  ELSE
    v_movement := NULL;
  END IF;

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
    new_data,
    reason,
    movement_summary
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
    v_new,
    v_reason,
    v_movement
  );

  RETURN NULL;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Reassign RPCs accept / store reason
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.fn_reassign_billing_record_party(uuid, uuid, uuid, boolean);

CREATE OR REPLACE FUNCTION public.fn_reassign_billing_record_party(
  p_bill_id uuid,
  p_old_party_id uuid,
  p_new_party_id uuid,
  p_confirm_move_payments boolean DEFAULT false,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bill public.party_billing_records;
  v_new_account_id uuid;
  v_new_party_name text;
  v_payment public.party_payment_receipts;
  v_bill_ids uuid[];
  v_exclusive_payment_ids uuid[] := ARRAY[]::uuid[];
  v_blocked_payment_ids uuid[] := ARRAY[]::uuid[];
  v_moved_payment_ids uuid[] := ARRAY[]::uuid[];
  v_exclusive_count integer := 0;
  v_moved_cn_count integer := 0;
  v_covered_cn_nos text[];
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reassign reason is required.';
  END IF;

  IF p_new_party_id IS NULL OR p_old_party_id IS NULL OR p_bill_id IS NULL THEN
    RAISE EXCEPTION 'Bill and party ids are required.';
  END IF;

  IF p_new_party_id = p_old_party_id THEN
    RAISE EXCEPTION 'New party is the same as the current party';
  END IF;

  SELECT *
  INTO v_bill
  FROM public.party_billing_records
  WHERE id = p_bill_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Billing record not found';
  END IF;

  IF v_bill.party_id IS DISTINCT FROM p_old_party_id THEN
    RAISE EXCEPTION 'Billing record not found';
  END IF;

  IF v_bill.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Only active billing records can be reassigned';
  END IF;

  SELECT p.name, a.id
  INTO v_new_party_name, v_new_account_id
  FROM public.parties p
  JOIN public.party_ledger_accounts a ON a.party_id = p.id
  WHERE p.id = p_new_party_id
    AND p.is_active = true;

  IF v_new_account_id IS NULL THEN
    RAISE EXCEPTION 'New party not found, is inactive, or does not have a ledger account';
  END IF;

  FOR v_payment IN
    SELECT *
    FROM public.party_payment_receipts
    WHERE status = 'ACTIVE'
      AND (
        related_billing_record_ids @> ARRAY[p_bill_id]::uuid[]
        OR EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(bill_allocations, '[]'::jsonb)) alloc
          WHERE (alloc->>'billing_record_id')::uuid = p_bill_id
        )
      )
  LOOP
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM (
        SELECT unnest(COALESCE(v_payment.related_billing_record_ids, ARRAY[]::uuid[])) AS x
        UNION ALL
        SELECT (alloc->>'billing_record_id')::uuid
        FROM jsonb_array_elements(COALESCE(v_payment.bill_allocations, '[]'::jsonb)) alloc
        WHERE NULLIF(alloc->>'billing_record_id', '') IS NOT NULL
      ) ids
      WHERE x IS NOT NULL
    )
    INTO v_bill_ids;

    IF (
      SELECT COUNT(DISTINCT bill_id)
      FROM unnest(v_bill_ids) AS bill_id
      WHERE bill_id IS NOT NULL
    ) > 1 THEN
      v_blocked_payment_ids := array_append(v_blocked_payment_ids, v_payment.id);
    ELSE
      v_exclusive_payment_ids := array_append(v_exclusive_payment_ids, v_payment.id);
    END IF;
  END LOOP;

  IF cardinality(v_blocked_payment_ids) > 0 THEN
    RAISE EXCEPTION '% payment receipt(s) linked to this bill also cover other bills. Reverse those payments first, then reassign the bill.',
      cardinality(v_blocked_payment_ids)
      USING ERRCODE = 'P0409';
  END IF;

  v_exclusive_count := COALESCE(cardinality(v_exclusive_payment_ids), 0);

  IF v_exclusive_count > 0 AND NOT COALESCE(p_confirm_move_payments, false) THEN
    RAISE EXCEPTION 'This bill has % linked payment(s). Confirm moving both the bill and those payments. Covered CNs move with the bill.',
      v_exclusive_count
      USING ERRCODE = 'P0409';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT trim(cn_no)
    FROM unnest(COALESCE(v_bill.covered_cn_nos, ARRAY[]::text[])) AS cn_no
    WHERE trim(cn_no) <> ''
  )
  INTO v_covered_cn_nos;

  IF COALESCE(cardinality(v_covered_cn_nos), 0) > 0 THEN
    UPDATE public.consignments
    SET
      billing_party_id = p_new_party_id,
      change_reason = v_reason
    WHERE trim(cn_no) = ANY (v_covered_cn_nos)
      AND cancel_cn = false
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_moved_cn_count = ROW_COUNT;
  END IF;

  UPDATE public.party_billing_records
  SET
    party_id = p_new_party_id,
    party_ledger_account_id = v_new_account_id,
    change_reason = v_reason
  WHERE id = p_bill_id;

  IF v_exclusive_count > 0 AND COALESCE(p_confirm_move_payments, false) THEN
    UPDATE public.party_payment_receipts
    SET
      party_id = p_new_party_id,
      party_ledger_account_id = v_new_account_id,
      change_reason = v_reason
    WHERE id = ANY (v_exclusive_payment_ids);

    v_moved_payment_ids := v_exclusive_payment_ids;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bill_id', p_bill_id,
    'bill_ref_no', v_bill.bill_ref_no,
    'old_party_id', p_old_party_id,
    'new_party_id', p_new_party_id,
    'new_party_name', v_new_party_name,
    'moved_payment_count', COALESCE(cardinality(v_moved_payment_ids), 0),
    'moved_cn_count', COALESCE(v_moved_cn_count, 0),
    'reason', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reassign_billing_record_party(uuid, uuid, uuid, boolean, text) TO authenticated;

DROP FUNCTION IF EXISTS public.fn_reassign_payment_receipt_party(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.fn_reassign_payment_receipt_party(
  p_receipt_id uuid,
  p_old_party_id uuid,
  p_new_party_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_receipt public.party_payment_receipts;
  v_new_account_id uuid;
  v_new_party_name text;
  v_reason text := NULLIF(trim(COALESCE(p_reason, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'Reassign reason is required.';
  END IF;

  IF p_receipt_id IS NULL OR p_old_party_id IS NULL OR p_new_party_id IS NULL THEN
    RAISE EXCEPTION 'Receipt and party ids are required.';
  END IF;

  IF p_new_party_id = p_old_party_id THEN
    RAISE EXCEPTION 'New party is the same as the current party';
  END IF;

  SELECT *
  INTO v_receipt
  FROM public.party_payment_receipts
  WHERE id = p_receipt_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment receipt not found';
  END IF;

  IF v_receipt.party_id IS DISTINCT FROM p_old_party_id THEN
    RAISE EXCEPTION 'Payment receipt not found';
  END IF;

  IF v_receipt.status IS DISTINCT FROM 'ACTIVE' THEN
    RAISE EXCEPTION 'Only active payment receipts can be reassigned';
  END IF;

  SELECT p.name, a.id
  INTO v_new_party_name, v_new_account_id
  FROM public.parties p
  JOIN public.party_ledger_accounts a ON a.party_id = p.id
  WHERE p.id = p_new_party_id
    AND p.is_active = true;

  IF v_new_account_id IS NULL THEN
    RAISE EXCEPTION 'New party not found, is inactive, or does not have a ledger account';
  END IF;

  UPDATE public.party_payment_receipts
  SET
    party_id = p_new_party_id,
    party_ledger_account_id = v_new_account_id,
    change_reason = v_reason
  WHERE id = p_receipt_id;

  RETURN jsonb_build_object(
    'success', true,
    'receipt_id', p_receipt_id,
    'old_party_id', p_old_party_id,
    'new_party_id', p_new_party_id,
    'new_party_name', v_new_party_name,
    'reason', v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_reassign_payment_receipt_party(uuid, uuid, uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
