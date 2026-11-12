-- CBS payments retain their own voucher and atomically post broker payments to
-- the existing ledger. Legacy challan advances are already paid, not paid again.
CREATE TABLE public.lorry_hire_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challan_id uuid NOT NULL REFERENCES public.challans(id) ON DELETE RESTRICT,
  branch_code text NOT NULL,
  payment_type text NOT NULL CHECK (payment_type IN ('ADVANCE','BALANCE')),
  payment_date date NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  payment_mode text NOT NULL CHECK (payment_mode IN ('CASH','CHEQUE','NEFT','RTGS','UPI')),
  paid_to text NOT NULL CHECK (btrim(paid_to) <> ''),
  reference_no text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  narration text NOT NULL CHECK (btrim(narration) <> ''),
  deduction_items jsonb NOT NULL DEFAULT '[]',
  addition_items jsonb NOT NULL DEFAULT '[]',
  deduction_total numeric(14,2) NOT NULL DEFAULT 0,
  addition_total numeric(14,2) NOT NULL DEFAULT 0,
  net_paid_amount numeric(14,2) NOT NULL DEFAULT 0 CHECK (net_paid_amount >= 0),
  broker_receipt_id uuid UNIQUE REFERENCES public.broker_challan_payment_receipts(id) ON DELETE RESTRICT,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (payment_mode = 'CASH' OR (btrim(reference_no) <> '' AND btrim(bank_name) <> ''))
);
CREATE INDEX ON public.lorry_hire_payments(challan_id);
ALTER TABLE public.lorry_hire_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY lhp_read ON public.lorry_hire_payments FOR SELECT TO authenticated
  USING (public.can_access_branch(branch_code));
CREATE POLICY lhp_insert ON public.lorry_hire_payments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND created_by = auth.uid() AND public.can_access_branch(branch_code));
GRANT SELECT, INSERT ON public.lorry_hire_payments TO authenticated;

-- Serialize all broker challan payments, including those made outside CBS.
CREATE FUNCTION public.fn_guard_challan_payment_balance() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch public.challans%ROWTYPE; allocation jsonb; paid numeric; requested numeric;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM public.lorry_hire_payments WHERE broker_receipt_id = OLD.id)
      AND (NEW.amount IS DISTINCT FROM OLD.amount OR NEW.challan_allocations IS DISTINCT FROM OLD.challan_allocations
        OR NEW.receipt_date IS DISTINCT FROM OLD.receipt_date OR NEW.payment_mode IS DISTINCT FROM OLD.payment_mode
        OR NEW.reference_no IS DISTINCT FROM OLD.reference_no OR NEW.bank_name IS DISTINCT FROM OLD.bank_name
        OR NEW.narration IS DISTINCT FROM OLD.narration OR NEW.payer_name IS DISTINCT FROM OLD.payer_name) THEN
      RAISE EXCEPTION 'CBS payment details are immutable. Reverse the receipt and record a new payment.';
    END IF;
  END IF;
  IF NEW.status <> 'ACTIVE' THEN RETURN NEW; END IF;
  IF jsonb_array_length(NEW.challan_allocations) <> (
    SELECT count(DISTINCT a->>'challan_no') FROM jsonb_array_elements(NEW.challan_allocations) a
  ) THEN RAISE EXCEPTION 'Duplicate challan allocations are not allowed'; END IF;
  -- A stable lock order also supports multi-challan receipts.
  PERFORM 1 FROM public.challans c
    WHERE c.challan_no IN (SELECT a->>'challan_no' FROM jsonb_array_elements(NEW.challan_allocations) a)
    ORDER BY c.id FOR UPDATE;
  FOR allocation IN SELECT value FROM jsonb_array_elements(NEW.challan_allocations) LOOP
    SELECT * INTO ch FROM public.challans WHERE challan_no = allocation->>'challan_no';
    IF NOT FOUND OR ch.status <> 'ACTIVE' OR ch.broker_id IS DISTINCT FROM NEW.broker_id THEN
      RAISE EXCEPTION 'Invalid or inactive challan for this broker';
    END IF;
    SELECT COALESCE(sum((a->>'settled_amount')::numeric),0) INTO paid
      FROM public.broker_challan_payment_receipts r CROSS JOIN LATERAL jsonb_array_elements(r.challan_allocations) a
      WHERE r.status = 'ACTIVE' AND r.id <> NEW.id AND a->>'challan_no' = ch.challan_no;
    requested := (allocation->>'settled_amount')::numeric;
    IF requested IS NULL OR requested <= 0 OR paid + requested >
      greatest(COALESCE(ch.total_hire_amount,0)+COALESCE(ch.extra_hire_amount,0)-COALESCE(ch.advance_amount,0)-COALESCE(ch.less_tds,0),0) THEN
      RAISE EXCEPTION 'Payment exceeds remaining balance for challan %', ch.challan_no;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_guard_challan_payment_balance BEFORE INSERT OR UPDATE ON public.broker_challan_payment_receipts
FOR EACH ROW EXECUTE FUNCTION public.fn_guard_challan_payment_balance();

CREATE FUNCTION public.fn_record_lorry_hire_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ch public.challans%ROWTYPE; paid numeric; remaining numeric; line jsonb; account_id uuid;
BEGIN
  SELECT * INTO ch FROM public.challans WHERE id = NEW.challan_id FOR UPDATE;
  IF NOT FOUND OR ch.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Select an active challan'; END IF;
  NEW.branch_code := ch.origin_branch_code;
  NEW.broker_receipt_id := NULL;
  NEW.deduction_total := 0; NEW.addition_total := 0;
  IF jsonb_typeof(NEW.deduction_items) <> 'array' OR jsonb_typeof(NEW.addition_items) <> 'array' THEN
    RAISE EXCEPTION 'Adjustments must be arrays';
  END IF;
  FOR line IN SELECT value FROM jsonb_array_elements(NEW.deduction_items || NEW.addition_items) LOOP
    IF NULLIF(btrim(line->>'label'),'') IS NULL OR COALESCE((line->>'amount')::numeric,0) <= 0 THEN
      RAISE EXCEPTION 'Each adjustment requires a description and a positive amount';
    END IF;
  END LOOP;
  SELECT COALESCE(sum((v->>'amount')::numeric),0) INTO NEW.deduction_total FROM jsonb_array_elements(NEW.deduction_items) v;
  SELECT COALESCE(sum((v->>'amount')::numeric),0) INTO NEW.addition_total FROM jsonb_array_elements(NEW.addition_items) v;
  IF NEW.payment_type = 'ADVANCE' AND (NEW.amount <= 0 OR NEW.deduction_total > 0 OR NEW.addition_total > 0) THEN
    RAISE EXCEPTION 'Adjustments are available on balance payments only';
  END IF;
  IF ch.broker_id IS NOT NULL THEN
    SELECT COALESCE(sum((a->>'settled_amount')::numeric),0) INTO paid
      FROM public.broker_challan_payment_receipts r CROSS JOIN LATERAL jsonb_array_elements(r.challan_allocations) a
      WHERE r.status = 'ACTIVE' AND a->>'challan_no' = ch.challan_no;
  ELSE
    SELECT COALESCE(sum(p.amount),0) INTO paid FROM public.lorry_hire_payments p WHERE p.challan_id = ch.id;
  END IF;
  remaining := greatest(COALESCE(ch.total_hire_amount,0)+COALESCE(ch.extra_hire_amount,0)-COALESCE(ch.advance_amount,0)-COALESCE(ch.less_tds,0)-paid,0);
  IF NEW.amount > remaining THEN RAISE EXCEPTION 'Payment exceeds remaining balance of %', remaining; END IF;
  NEW.net_paid_amount := NEW.amount + NEW.addition_total - NEW.deduction_total;
  IF NEW.net_paid_amount < 0 THEN RAISE EXCEPTION 'Deductions cannot exceed payment plus additions'; END IF;
  IF NEW.amount = 0 AND NEW.net_paid_amount <= 0 THEN RAISE EXCEPTION 'An additional payment must have a positive final amount'; END IF;
  IF ch.broker_id IS NOT NULL AND NEW.amount > 0 THEN
    SELECT id INTO account_id FROM public.broker_ledger_accounts WHERE broker_id = ch.broker_id;
    INSERT INTO public.broker_challan_payment_receipts
      (broker_ledger_account_id, broker_id, receipt_date, amount, actual_received_amount, payment_mode,
       reference_no, bank_name, narration, payer_name, branch_code, created_by, challan_allocations)
    VALUES (account_id, ch.broker_id, NEW.payment_date, NEW.amount, NEW.amount, NEW.payment_mode,
      NEW.reference_no, NEW.bank_name, NEW.narration, NEW.paid_to, NEW.branch_code, NEW.created_by,
      jsonb_build_array(jsonb_build_object('challan_no',ch.challan_no,'settled_amount',NEW.amount,
      'deduction_items',NEW.deduction_items,'addition_items',NEW.addition_items,
      'deduction_total',NEW.deduction_total,'addition_total',NEW.addition_total,'net_paid_amount',NEW.net_paid_amount)))
    RETURNING id INTO NEW.broker_receipt_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_record_lorry_hire_payment BEFORE INSERT ON public.lorry_hire_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_record_lorry_hire_payment();

-- Vouchers are immutable; broker reversals continue through the existing ledger.
CREATE FUNCTION public.fn_protect_lorry_hire_payment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CBS vouchers cannot be edited or deleted'; END; $$;
CREATE TRIGGER trg_protect_lorry_hire_payment BEFORE UPDATE OR DELETE ON public.lorry_hire_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_lorry_hire_payment();
-- Individual reasons and amounts are independently queryable for reporting.
-- The JSON arrays above are immutable voucher snapshots for ledger compatibility.
CREATE TABLE public.lorry_hire_payment_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.lorry_hire_payments(id) ON DELETE RESTRICT,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('ADDITION','DEDUCTION')),
  description text NOT NULL CHECK (btrim(description) <> ''),
  amount numeric(14,2) NOT NULL CHECK (amount > 0)
);
CREATE INDEX ON public.lorry_hire_payment_adjustments(payment_id);
ALTER TABLE public.lorry_hire_payment_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY lhpa_read ON public.lorry_hire_payment_adjustments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lorry_hire_payments p WHERE p.id = payment_id AND public.can_access_branch(p.branch_code)));
GRANT SELECT ON public.lorry_hire_payment_adjustments TO authenticated;
CREATE FUNCTION public.fn_record_lorry_hire_adjustments() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.lorry_hire_payment_adjustments(payment_id, adjustment_type, description, amount)
    SELECT NEW.id, 'ADDITION', v->>'label', (v->>'amount')::numeric FROM jsonb_array_elements(NEW.addition_items) v
    UNION ALL
    SELECT NEW.id, 'DEDUCTION', v->>'label', (v->>'amount')::numeric FROM jsonb_array_elements(NEW.deduction_items) v;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_record_lorry_hire_adjustments AFTER INSERT ON public.lorry_hire_payments
FOR EACH ROW EXECUTE FUNCTION public.fn_record_lorry_hire_adjustments();
CREATE TRIGGER trg_protect_lorry_hire_adjustments BEFORE UPDATE OR DELETE ON public.lorry_hire_payment_adjustments
FOR EACH ROW EXECUTE FUNCTION public.fn_protect_lorry_hire_payment();
NOTIFY pgrst, 'reload schema';
