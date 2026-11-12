-- CBS Advance writes the same challan.advance_amount used on the challan form.
-- It must not also settle hire through a broker receipt, or remaining would drop twice.
CREATE OR REPLACE FUNCTION public.fn_record_lorry_hire_payment() RETURNS trigger
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
    SELECT COALESCE(sum(p.amount),0) INTO paid
      FROM public.lorry_hire_payments p
      WHERE p.challan_id = ch.id AND p.payment_type = 'BALANCE';
  END IF;
  remaining := greatest(COALESCE(ch.total_hire_amount,0)+COALESCE(ch.extra_hire_amount,0)-COALESCE(ch.advance_amount,0)-COALESCE(ch.less_tds,0)-paid,0);
  IF NEW.amount > remaining THEN RAISE EXCEPTION 'Payment exceeds remaining balance of %', remaining; END IF;
  NEW.net_paid_amount := NEW.amount + NEW.addition_total - NEW.deduction_total;
  IF NEW.net_paid_amount < 0 THEN RAISE EXCEPTION 'Deductions cannot exceed payment plus additions'; END IF;
  IF NEW.amount = 0 AND NEW.net_paid_amount <= 0 THEN RAISE EXCEPTION 'An additional payment must have a positive final amount'; END IF;
  IF NEW.payment_type = 'ADVANCE' THEN
    UPDATE public.challans
      SET advance_amount = ROUND(COALESCE(advance_amount, 0) + NEW.amount, 2)
      WHERE id = ch.id;
    RETURN NEW;
  END IF;
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
NOTIFY pgrst, 'reload schema';
