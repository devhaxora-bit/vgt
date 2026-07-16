import { createClient } from '@/utils/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const CN_SELECT_FIELDS =
    'id, cn_no, invoice_no, bkg_date, booking_branch, loading_point, dest_branch, delivery_point, no_of_pkg, total_qty, actual_weight, charged_weight, load_unit, total_freight, vehicle_no, goods_desc, freight_included, parent_cn_id, consignor_name, consignee_name';

const toNumber = (value: unknown) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
};

const roundMoney = (value: number) => Number(value.toFixed(2));

type PaymentLike = {
    status?: string | null;
    amount?: number | string | null;
    related_billing_record_ids?: string[] | null;
    bill_allocations?: Array<{ billing_record_id?: string; settled_amount?: number | null }> | null;
};

const buildSettledBillAmountMap = (paymentReceipts: PaymentLike[]) => {
    const map = new Map<string, number>();

    paymentReceipts.forEach((receipt) => {
        if (String(receipt.status || '').toUpperCase() !== 'ACTIVE') return;

        const allocations = Array.isArray(receipt.bill_allocations) ? receipt.bill_allocations : [];
        if (allocations.length > 0) {
            allocations.forEach((allocation) => {
                const billId = String(allocation.billing_record_id || '').trim();
                if (!billId) return;
                map.set(billId, roundMoney((map.get(billId) || 0) + toNumber(allocation.settled_amount)));
            });
            return;
        }

        const related = Array.isArray(receipt.related_billing_record_ids)
            ? receipt.related_billing_record_ids.map((id) => String(id).trim()).filter(Boolean)
            : [];
        if (related.length === 1) {
            const billId = related[0];
            map.set(billId, roundMoney((map.get(billId) || 0) + toNumber(receipt.amount)));
        }
    });

    return map;
};

// GET /api/query/parties?q=name  -> search parties by name / code / GSTIN
// GET /api/query/parties?id=uuid -> party detail with bills, payments, CNs, related challans, dues
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id')?.trim();
    const q = searchParams.get('q')?.trim();

    if (id) {
        const { data: partyRow, error: partyError } = await supabase
            .from('parties')
            .select('id, name, code, type, phone, gstin, address, branch_code')
            .eq('id', id)
            .single();

        if (partyError || !partyRow) {
            return NextResponse.json({ error: 'Party not found' }, { status: 404 });
        }

        const forbidden = auth.forbidIfForeignBranch(partyRow.branch_code);
        if (forbidden) return forbidden;

        let branchName: string | null = null;
        if (partyRow.branch_code) {
            const { data: branch } = await supabase
                .from('branches')
                .select('name')
                .eq('code', partyRow.branch_code)
                .maybeSingle();
            branchName = branch?.name ?? null;
        }

        const [
            { data: account },
            { data: billingRecords },
            { data: paymentReceipts },
            { data: consignments },
        ] = await Promise.all([
            supabase
                .from('party_ledger_accounts')
                .select('opening_balance')
                .eq('party_id', id)
                .maybeSingle(),
            supabase
                .from('party_billing_records')
                .select('id, bill_ref_no, billing_date, amount, status, covered_cn_nos, created_at')
                .eq('party_id', id)
                .order('billing_date', { ascending: false })
                .order('created_at', { ascending: false }),
            supabase
                .from('party_payment_receipts')
                .select('id, receipt_date, amount, payment_mode, reference_no, status, related_billing_record_ids, bill_allocations')
                .eq('party_id', id)
                .order('receipt_date', { ascending: false }),
            supabase
                .from('consignments')
                .select(CN_SELECT_FIELDS)
                .eq('billing_party_id', id)
                .eq('cancel_cn', false)
                .order('bkg_date', { ascending: false })
                .order('cn_no', { ascending: false })
                .limit(100),
        ]);

        const activeBills = (billingRecords || []).filter((bill) => String(bill.status).toUpperCase() === 'ACTIVE');
        const activePayments = (paymentReceipts || []).filter((payment) => String(payment.status).toUpperCase() === 'ACTIVE');
        const settledMap = buildSettledBillAmountMap(paymentReceipts || []);
        const billLookup = new Map((billingRecords || []).map((bill) => [bill.id, bill]));

        const totalCnsAmount = roundMoney(
            (consignments || []).reduce((sum, cn) => sum + toNumber(cn.total_freight), 0),
        );
        const totalBilled = roundMoney(activeBills.reduce((sum, bill) => sum + toNumber(bill.amount), 0));
        const totalPaid = roundMoney(activePayments.reduce((sum, payment) => sum + toNumber(payment.amount), 0));
        const openingBalance = roundMoney(toNumber(account?.opening_balance));
        const rawUnbilled = roundMoney(totalCnsAmount - totalBilled);

        const bills = (billingRecords || []).slice(0, 50).map((bill) => {
            const amount = roundMoney(toNumber(bill.amount));
            const paidAmount = String(bill.status).toUpperCase() === 'ACTIVE'
                ? roundMoney(settledMap.get(bill.id) || 0)
                : 0;
            return {
                id: bill.id,
                bill_ref_no: bill.bill_ref_no,
                billing_date: bill.billing_date,
                amount,
                paid_amount: paidAmount,
                balance_amount: String(bill.status).toUpperCase() === 'ACTIVE'
                    ? roundMoney(Math.max(amount - paidAmount, 0))
                    : 0,
                status: bill.status,
                covered_count: Array.isArray(bill.covered_cn_nos) ? bill.covered_cn_nos.length : 0,
            };
        });

        const payments = (paymentReceipts || []).slice(0, 50).map((payment) => {
            const allocations = Array.isArray(payment.bill_allocations) ? payment.bill_allocations : [];
            const linkedFromAllocations = allocations
                .map((allocation) => {
                    const billId = String(allocation.billing_record_id || '').trim();
                    return billLookup.get(billId)?.bill_ref_no || billId.slice(0, 8).toUpperCase();
                })
                .filter(Boolean);
            const linkedFromRelated = Array.isArray(payment.related_billing_record_ids)
                ? payment.related_billing_record_ids
                    .map((billId) => billLookup.get(String(billId))?.bill_ref_no || String(billId).slice(0, 8).toUpperCase())
                    .filter(Boolean)
                : [];
            const linkedBills = (linkedFromAllocations.length > 0 ? linkedFromAllocations : linkedFromRelated).join(', ');

            return {
                id: payment.id,
                receipt_date: payment.receipt_date,
                amount: roundMoney(toNumber(payment.amount)),
                payment_mode: payment.payment_mode,
                reference_no: payment.reference_no,
                status: payment.status,
                linked_bills: linkedBills || '—',
            };
        });

        const cnNos = (consignments || []).map((cn) => String(cn.cn_no || '').trim()).filter(Boolean);
        let challans: Array<{
            id: string;
            challan_no: string;
            date_from: string | null;
            vehicle_no: string | null;
            broker_name: string | null;
            total_hire_amount: number;
            linked_cn_count: number;
        }> = [];

        if (cnNos.length > 0) {
            const { data: challanRows } = await supabase
                .from('challans')
                .select('id, challan_no, date_from, vehicle_no, broker_name, total_hire_amount, extra_hire_amount, linked_cn_nos, status')
                .eq('status', 'ACTIVE')
                .overlaps('linked_cn_nos', cnNos.slice(0, 80))
                .order('date_from', { ascending: false })
                .limit(40);

            const cnSet = new Set(cnNos);
            challans = (challanRows || [])
                .map((challan) => {
                    const linked = Array.isArray(challan.linked_cn_nos)
                        ? challan.linked_cn_nos.map((value: unknown) => String(value).trim()).filter(Boolean)
                        : [];
                    const matched = linked.filter((cnNo) => cnSet.has(cnNo));
                    return {
                        id: challan.id,
                        challan_no: challan.challan_no,
                        date_from: challan.date_from,
                        vehicle_no: challan.vehicle_no,
                        broker_name: challan.broker_name,
                        total_hire_amount: roundMoney(
                            toNumber(challan.total_hire_amount) + toNumber(challan.extra_hire_amount),
                        ),
                        linked_cn_count: matched.length,
                    };
                })
                .filter((challan) => challan.linked_cn_count > 0);
        }

        return NextResponse.json({
            party: { ...partyRow, branch_name: branchName },
            summary: {
                opening_balance: openingBalance,
                total_billed: totalBilled,
                total_paid: totalPaid,
                outstanding: roundMoney(openingBalance + totalBilled - totalPaid),
                unbilled_amount: Math.max(rawUnbilled, 0),
                overbilled_amount: Math.max(-rawUnbilled, 0),
                total_cns_amount: totalCnsAmount,
                total_cns_count: (consignments || []).length,
                total_bills_count: activeBills.length,
            },
            bills,
            payments,
            consignments: consignments || [],
            challans,
        });
    }

    if (q === undefined || q === null) {
        return NextResponse.json({ error: 'Provide ?q= or ?id=' }, { status: 400 });
    }
    if (q.length < 1) return NextResponse.json([]);

    const { data: parties, error } = await (() => {
        let query = supabase
            .from('parties')
            .select('id, name, code, gstin, phone, branch_code')
            .or(`name.ilike.%${q}%,code.ilike.%${q}%,gstin.ilike.%${q}%`)
            .order('name', { ascending: true })
            .limit(20);
        const listBranch = auth.resolveListBranch(null);
        if (listBranch) {
            query = query.eq('branch_code', listBranch);
        }
        return query;
    })();

    if (error) {
        console.error('[query/parties search]', error);
        return NextResponse.json([]);
    }

    const partyIds = (parties || []).map((party) => party.id);
    const branchCodes = Array.from(new Set((parties || []).map((party) => party.branch_code).filter(Boolean))) as string[];

    const branchMap = new Map<string, string>();
    if (branchCodes.length > 0) {
        const { data: branches } = await supabase
            .from('branches')
            .select('code, name')
            .in('code', branchCodes);
        (branches || []).forEach((branch) => branchMap.set(branch.code, branch.name));
    }

    const summaryMap = new Map<string, { outstanding: number; total_billed: number; total_paid: number }>();
    if (partyIds.length > 0) {
        const { data: summaries } = await supabase
            .from('vw_party_ledger_summary')
            .select('party_id, outstanding, total_billed, total_paid')
            .in('party_id', partyIds);
        (summaries || []).forEach((row) => {
            summaryMap.set(row.party_id, {
                outstanding: toNumber(row.outstanding),
                total_billed: toNumber(row.total_billed),
                total_paid: toNumber(row.total_paid),
            });
        });
    }

    const result = (parties || []).map((party) => {
        const summary = summaryMap.get(party.id);
        return {
            id: party.id,
            name: party.name,
            code: party.code,
            gstin: party.gstin,
            phone: party.phone,
            branch_code: party.branch_code,
            branch_name: party.branch_code ? branchMap.get(party.branch_code) ?? null : null,
            outstanding: summary?.outstanding ?? 0,
            total_billed: summary?.total_billed ?? 0,
            total_paid: summary?.total_paid ?? 0,
        };
    });

    return NextResponse.json(result);
}
