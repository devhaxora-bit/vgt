-- Run only against an EMPTY disposable PostgreSQL database:
-- psql -v ON_ERROR_STOP=1 -d <test database> -f scripts/test-lorry-hire.sql
-- All fixtures and migration changes are rolled back.
BEGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE ROLE authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-000000000001'::uuid $$;
CREATE FUNCTION public.is_admin(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.can_access_branch(text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE TABLE public.challans(id uuid PRIMARY KEY, challan_no text UNIQUE, origin_branch_code text, broker_id uuid, status text DEFAULT 'ACTIVE', total_hire_amount numeric DEFAULT 1000, extra_hire_amount numeric DEFAULT 100, advance_amount numeric DEFAULT 200, less_tds numeric DEFAULT 10);
CREATE TABLE public.broker_ledger_accounts(id uuid PRIMARY KEY, broker_id uuid UNIQUE);
CREATE TABLE public.broker_challan_payment_receipts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), broker_ledger_account_id uuid, broker_id uuid, receipt_date date, amount numeric, actual_received_amount numeric, payment_mode text, reference_no text, bank_name text, narration text, payer_name text, branch_code text, created_by uuid, challan_allocations jsonb DEFAULT '[]', status text DEFAULT 'ACTIVE');
\ir ../supabase/migrations/20261111000100_lorry_hire_cbs.sql
\ir ../supabase/migrations/20261111000200_cbs_advance_syncs_challan.sql
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.broker_ledger_accounts VALUES ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003');
INSERT INTO public.challans(id,challan_no,origin_branch_code,broker_id) VALUES
 ('00000000-0000-0000-0000-000000000004','TEST-BROKER','VZM','00000000-0000-0000-0000-000000000003'),
 ('00000000-0000-0000-0000-000000000005','TEST-DIRECT','VZM',NULL);
DO $$
DECLARE ch uuid; row public.lorry_hire_payments%ROWTYPE; total numeric; rejected boolean;
BEGIN
  FOREACH ch IN ARRAY ARRAY['00000000-0000-0000-0000-000000000004'::uuid,'00000000-0000-0000-0000-000000000005'::uuid] LOOP
    INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by)
      VALUES(ch,'FAKE','ADVANCE',current_date,100,'CASH','Owner','Advance','00000000-0000-0000-0000-000000000001') RETURNING * INTO row;
    ASSERT row.branch_code = 'VZM', 'Branch must come from challan';
    ASSERT row.net_paid_amount = 100, 'Advance cash total incorrect';
    ASSERT row.broker_receipt_id IS NULL, 'Advance must update the challan, not create a second hire settlement';
    ASSERT (SELECT advance_amount FROM public.challans WHERE id = ch) = 300, 'CBS advance must update challan.advance_amount';
    rejected := false;
    BEGIN
      INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by)
        VALUES(ch,'VZM','BALANCE',current_date,791,'CASH','Owner','Overpayment','00000000-0000-0000-0000-000000000001');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    ASSERT rejected, 'Overpayment was accepted';
    rejected := false;
    BEGIN
      INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by,deduction_items)
        VALUES(ch,'VZM','BALANCE',current_date,790,'CASH','Owner','Invalid deduction','00000000-0000-0000-0000-000000000001','[{"label":"", "amount":20}]');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    ASSERT rejected, 'Adjustment without description was accepted';
    rejected := false;
    BEGIN
      INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by)
        VALUES(ch,'VZM','BALANCE',current_date,790,'NEFT','Owner','Missing bank details','00000000-0000-0000-0000-000000000001');
    EXCEPTION WHEN check_violation THEN rejected := true; END;
    ASSERT rejected, 'Non-cash payment accepted without bank/reference';
  END LOOP;
END $$;
-- Complete the balance settlement for both broker and direct hires.
DO $$
DECLARE ch uuid; row public.lorry_hire_payments%ROWTYPE; rejected boolean;
BEGIN
  FOREACH ch IN ARRAY ARRAY['00000000-0000-0000-0000-000000000004'::uuid,'00000000-0000-0000-0000-000000000005'::uuid] LOOP
    INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by,reference_no,bank_name,deduction_items,addition_items)
      VALUES(ch,'VZM','BALANCE',current_date,790,'NEFT','Owner','Final settlement','00000000-0000-0000-0000-000000000001','UTR-TEST','Test Bank','[{"label":"Shortage", "amount":20}]','[{"label":"Unloading", "amount":50}]') RETURNING * INTO row;
    ASSERT row.net_paid_amount = 820, 'Final payment should include additions and deductions';
    rejected := false;
    BEGIN
      INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by)
        VALUES(ch,'VZM','ADVANCE',current_date,1,'CASH','Owner','Already paid','00000000-0000-0000-0000-000000000001');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    ASSERT rejected, 'Fully paid challan accepted another hire payment';
    INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by,addition_items,deduction_items)
      VALUES(ch,'VZM','BALANCE',current_date,0,'CASH','Owner','Extra charges after hire settlement','00000000-0000-0000-0000-000000000001',
        '[{"label":"Additional unloading", "amount":150}]','[{"label":"Discount", "amount":25}]') RETURNING * INTO row;
    ASSERT row.net_paid_amount = 125, 'Extra payment after clearing balance should be accepted';
    ASSERT row.broker_receipt_id IS NULL, 'Extra-only payment must not settle original hire twice';
    ASSERT (SELECT count(*) FROM public.lorry_hire_payment_adjustments WHERE payment_id = row.id) = 2, 'Reasons must be stored as separate adjustment rows';
    rejected := false;
    BEGIN
      INSERT INTO public.lorry_hire_payments(challan_id,branch_code,payment_type,payment_date,amount,payment_mode,paid_to,narration,created_by)
        VALUES(ch,'VZM','BALANCE',current_date,0,'CASH','Owner','Empty payment','00000000-0000-0000-0000-000000000001');
    EXCEPTION WHEN raise_exception THEN rejected := true; END;
    ASSERT rejected, 'Empty additional payment must be rejected';
  END LOOP;
  ASSERT (SELECT sum(amount) FROM public.broker_challan_payment_receipts WHERE status='ACTIVE') = 790, 'Broker ledger must count balance payments once; advance lives on the challan';
  rejected := false;
  BEGIN
    INSERT INTO public.broker_challan_payment_receipts(broker_id,amount,challan_allocations)
      VALUES('00000000-0000-0000-0000-000000000003',1,'[{"challan_no":"TEST-BROKER","settled_amount":1}]');
  EXCEPTION WHEN raise_exception THEN rejected := true; END;
  ASSERT rejected, 'Existing ledger could pay a challan already settled through CBS';
  RAISE NOTICE 'CBS advance, settlement, adjustments, broker posting and overpayment tests passed';
END $$;
ROLLBACK;
