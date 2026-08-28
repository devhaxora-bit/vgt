import { NextResponse } from 'next/server';
import { requireAuthz } from '@/lib/server/requireAuthz';

const roundMoney = (value: number) => Number(value.toFixed(2));
const toMoney = (value: number | string | null | undefined) => Number(value || 0) || 0;

type BillAllocation = {
    billing_record_id?: string;
    settled_amount?: number | null;
};

type BillingRecord = {
    id: string;
    party_id: string;
    bill_no: string | null;
    billing_date: string | null;
    amount: number | string | null;
    status: string;
    branch_code: string | null;
    parties: {
        id: string;
        name: string;
        code: string;
        branch_code: string | null;
    } | null;
};

type PaymentReceipt = {
    party_id: string;
    status: string;
    bill_allocations: BillAllocation[] | null;
};

export type OutstandingBill = {
    id: string;
    bill_no: string | null;
    billing_date: string | null;
    amount: number;
    paid_amount: number;
    outstanding: number;
};

export type OutstandingPartyRow = {
    party_id: string;
    party_name: string;
    party_code: string;
    branch_code: string | null;
    branch_name: string | null;
    total_outstanding: number;
    total_billed: number;
    total_paid: number;
    bills: OutstandingBill[];
};

// GET /api/outstanding
// Returns bill-wise outstanding amounts grouped by party.
// Query params:
//   branch     - branch code filter
//   date_from  - billing_date >= (YYYY-MM-DD)
//   date_to    - billing_date <= (YYYY-MM-DD)
//   search     - party name / code ilike
export async function GET(request: Request) {
    const auth = await requireAuthz();
    if (!auth.ok) return auth.response;

    const supabase = auth.supabase;
    const { searchParams } = new URL(request.url);

    const branch = auth.resolveListBranch(searchParams.get('branch'));
    const dateFrom = searchParams.get('date_from')?.trim();
    const dateTo = searchParams.get('date_to')?.trim();
    const search = searchParams.get('search')?.trim();

    // Step 1: Fetch active billing records with party info
    let billQuery = supabase
        .from('party_billing_records')
        .select('id, party_id, bill_no, billing_date, amount, status, branch_code, parties(id, name, code, branch_code)')
        .eq('status', 'ACTIVE')
        .order('billing_date', { ascending: false })
        .limit(5000);

    if (branch) {
        billQuery = billQuery.eq('branch_code', branch);
    }
    if (dateFrom) {
        billQuery = billQuery.gte('billing_date', dateFrom);
    }
    if (dateTo) {
        billQuery = billQuery.lte('billing_date', dateTo);
    }

    const { data: billsRaw, error: billsError } = await billQuery;

    if (billsError) {
        console.error('Failed to fetch billing records:', billsError);
        return NextResponse.json({ error: billsError.message }, { status: 500 });
    }

    const bills = (billsRaw || []) as unknown as BillingRecord[];

    // Apply party name / code search filter
    const filteredBills = search
        ? bills.filter((bill) => {
              const partyName = (bill.parties?.name || '').toLowerCase();
              const partyCode = (bill.parties?.code || '').toLowerCase();
              const q = search.toLowerCase();
              return partyName.includes(q) || partyCode.includes(q);
          })
        : bills;

    if (filteredBills.length === 0) {
        return NextResponse.json([]);
    }

    const partyIds = Array.from(new Set(filteredBills.map((b) => b.party_id)));
    const billIds = filteredBills.map((b) => b.id);

    // Step 2: Fetch active payment receipts that have allocations for these bills
    const { data: receiptsRaw, error: receiptsError } = await supabase
        .from('party_payment_receipts')
        .select('party_id, status, bill_allocations')
        .eq('status', 'ACTIVE')
        .in('party_id', partyIds)
        .limit(10000);

    if (receiptsError) {
        console.error('Failed to fetch payment receipts:', receiptsError);
        return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    // Step 3: Build paidByBillId map
    const paidByBillId = new Map<string, number>();
    const billIdSet = new Set(billIds);

    (receiptsRaw || []).forEach((receipt: PaymentReceipt) => {
        if (receipt.status !== 'ACTIVE') return;
        const allocations: BillAllocation[] = Array.isArray(receipt.bill_allocations)
            ? receipt.bill_allocations
            : [];
        allocations.forEach((alloc) => {
            const billId = String(alloc.billing_record_id || '').trim();
            if (!billId || !billIdSet.has(billId)) return;
            const prev = paidByBillId.get(billId) || 0;
            paidByBillId.set(billId, roundMoney(prev + toMoney(alloc.settled_amount)));
        });
    });

    // Step 4: Fetch branch names for parties
    const branchCodes = Array.from(
        new Set(filteredBills.map((b) => b.parties?.branch_code).filter(Boolean) as string[])
    );
    const branchNameMap = new Map<string, string>();
    if (branchCodes.length > 0) {
        const { data: branchRows } = await supabase
            .from('branches')
            .select('code, name')
            .in('code', branchCodes);
        (branchRows || []).forEach((row: { code: string; name: string }) => {
            branchNameMap.set(row.code, row.name);
        });
    }

    // Step 5: Group by party, compute per-bill outstanding
    const partyMap = new Map<string, OutstandingPartyRow>();

    filteredBills.forEach((bill) => {
        const party = bill.parties;
        if (!party) return;

        const billAmount = toMoney(bill.amount);
        const paidAmount = paidByBillId.get(bill.id) || 0;
        const outstanding = roundMoney(billAmount - paidAmount);

        // Only include bills that still have outstanding > 0
        if (outstanding <= 0) return;

        const partyBranchCode = party.branch_code;
        const partyBranchName = partyBranchCode ? (branchNameMap.get(partyBranchCode) || null) : null;

        if (!partyMap.has(party.id)) {
            partyMap.set(party.id, {
                party_id: party.id,
                party_name: party.name,
                party_code: party.code,
                branch_code: partyBranchCode,
                branch_name: partyBranchName,
                total_outstanding: 0,
                total_billed: 0,
                total_paid: 0,
                bills: [],
            });
        }

        const partyRow = partyMap.get(party.id)!;
        partyRow.bills.push({
            id: bill.id,
            bill_no: bill.bill_no,
            billing_date: bill.billing_date,
            amount: billAmount,
            paid_amount: paidAmount,
            outstanding,
        });
        partyRow.total_billed = roundMoney(partyRow.total_billed + billAmount);
        partyRow.total_paid = roundMoney(partyRow.total_paid + paidAmount);
        partyRow.total_outstanding = roundMoney(partyRow.total_outstanding + outstanding);
    });

    // Sort bills within each party by billing_date desc
    const result = Array.from(partyMap.values())
        .sort((a, b) => a.party_name.localeCompare(b.party_name));

    return NextResponse.json(result);
}
