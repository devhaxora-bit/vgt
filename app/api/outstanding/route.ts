import { NextResponse } from 'next/server';
import { roundMoney } from '@/lib/money';
import { requireAuthz } from '@/lib/server/requireAuthz';
import { buildSettledBillAmountMap } from '@/lib/server/partyPaymentReceipts';
const toMoney = (value: number | string | null | undefined) => Number(value || 0) || 0;

type BillingRecord = {
    id: string;
    party_id: string;
    bill_ref_no: string | null;
    billing_date: string | null;
    amount: number | string | null;
    status: string;
    branch_code: string | null;
    parties: {
        id: string;
        name: string;
        code: string;
        branch_code: string | null;
        address: string | null;
        city: string | null;
        state: string | null;
        pincode: string | null;
        gstin: string | null;
    } | null;
};

type PaymentReceipt = {
    id: string;
    party_id: string;
    status: string;
    amount: number | null;
    related_billing_record_ids: string[] | null;
    bill_allocations: Array<{
        billing_record_id?: string;
        settled_amount?: number | null;
    }> | null;
};

export type OutstandingBill = {
    id: string;
    bill_ref_no: string | null;
    billing_date: string | null;
    amount: number;
    paid_amount: number;
    outstanding: number;
    /** paid = fully settled, partial = some paid still due, due = nothing paid yet */
    pay_status: 'paid' | 'partial' | 'due';
};

export type OutstandingPartyRow = {
    party_id: string;
    party_name: string;
    party_code: string;
    party_address: string | null;
    party_gstin: string | null;
    branch_code: string | null;
    branch_name: string | null;
    total_outstanding: number;
    total_billed: number;
    total_paid: number;
    bills: OutstandingBill[];
};

const formatPartyAddress = (party: NonNullable<BillingRecord['parties']>) => {
    const base = String(party.address || '').trim();
    const city = String(party.city || '').trim();
    const state = String(party.state || '').trim();
    const pincode = String(party.pincode || '').trim();

    const location = [city, state].filter(Boolean).join(', ');
    const withPin = location && pincode
        ? `${location} - ${pincode}`
        : location || (pincode ? pincode : '');

    if (base && withPin) {
        if (pincode && base.includes(pincode)) return base;
        return `${base}, ${withPin}`;
    }
    return base || withPin || null;
};

/**
 * Payments with no bill allocations / related bill still reduce party dues in the ledger.
 * Apply them FIFO to oldest unpaid bills so Outstanding totals match Party Ledger.
 */
const applyUnallocatedPaymentsFifo = (
    bills: OutstandingBill[],
    unallocatedByParty: Map<string, number>,
    partyId: string,
): OutstandingBill[] => {
    let remaining = roundMoney(unallocatedByParty.get(partyId) || 0);
    if (remaining <= 0.005) return bills;

    const sortedIndexes = bills
        .map((bill, index) => ({ bill, index }))
        .sort((a, b) => {
            const da = a.bill.billing_date || '';
            const db = b.bill.billing_date || '';
            if (da !== db) return da.localeCompare(db);
            return a.bill.bill_ref_no?.localeCompare(b.bill.bill_ref_no || '') || 0;
        });

    const next = bills.map((bill) => ({ ...bill }));

    for (const { index } of sortedIndexes) {
        if (remaining <= 0.005) break;
        const bill = next[index];
        if (bill.outstanding <= 0.005) continue;

        const apply = Math.min(bill.outstanding, remaining);
        const paidAmount = roundMoney(bill.paid_amount + apply);
        const outstanding = roundMoney(Math.max(bill.amount - paidAmount, 0));
        remaining = roundMoney(remaining - apply);

        next[index] = {
            ...bill,
            paid_amount: paidAmount,
            outstanding,
            pay_status:
                outstanding <= 0.005 ? 'paid' : paidAmount > 0.005 ? 'partial' : 'due',
        };
    }

    return next;
};

// GET /api/outstanding
// Returns bill-wise amounts grouped by party (all ACTIVE bills: due / partial / paid).
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
        .select('id, party_id, bill_ref_no, billing_date, amount, status, branch_code, parties(id, name, code, branch_code, address, city, state, pincode, gstin)')
        .eq('status', 'ACTIVE')
        .order('billing_date', { ascending: false })
        .limit(10000);

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

    // Step 2: Fetch active payment receipts for these parties
    const { data: receiptsRaw, error: receiptsError } = await supabase
        .from('party_payment_receipts')
        .select('id, party_id, status, amount, related_billing_record_ids, bill_allocations')
        .eq('status', 'ACTIVE')
        .in('party_id', partyIds)
        .limit(20000);

    if (receiptsError) {
        console.error('Failed to fetch payment receipts:', receiptsError);
        return NextResponse.json({ error: receiptsError.message }, { status: 500 });
    }

    const receipts: PaymentReceipt[] = (receiptsRaw || []).map((row) => ({
        id: String(row.id),
        party_id: String(row.party_id),
        status: String(row.status || ''),
        amount: toMoney(row.amount as number | string | null),
        related_billing_record_ids: Array.isArray(row.related_billing_record_ids)
            ? row.related_billing_record_ids.map((id) => String(id))
            : null,
        bill_allocations: Array.isArray(row.bill_allocations)
            ? row.bill_allocations.map((allocation) => ({
                  billing_record_id: allocation?.billing_record_id
                      ? String(allocation.billing_record_id)
                      : undefined,
                  settled_amount: toMoney(allocation?.settled_amount),
              }))
            : null,
    }));

    // Same settlement rules as ledger UI (allocations, else single related bill).
    const paidByBillId = buildSettledBillAmountMap(receipts);

    // Unallocated receipts (no allocations and not a single related bill) still count in ledger paid.
    const unallocatedByParty = new Map<string, number>();
    receipts.forEach((receipt) => {
        const hasAllocations = Array.isArray(receipt.bill_allocations) && receipt.bill_allocations.length > 0;
        const relatedCount = Array.isArray(receipt.related_billing_record_ids)
            ? receipt.related_billing_record_ids.length
            : 0;
        if (hasAllocations || relatedCount === 1) return;
        const prev = unallocatedByParty.get(receipt.party_id) || 0;
        unallocatedByParty.set(receipt.party_id, roundMoney(prev + toMoney(receipt.amount)));
    });

    // Opening balances (included in party ledger outstanding)
    const { data: accountRows } = await supabase
        .from('party_ledger_accounts')
        .select('party_id, opening_balance')
        .in('party_id', partyIds);
    const openingByParty = new Map<string, number>();
    (accountRows || []).forEach((row: { party_id: string; opening_balance: number | string | null }) => {
        openingByParty.set(row.party_id, toMoney(row.opening_balance));
    });

    // Step 3: Fetch branch names for parties
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

    // Step 4: Group by party
    const partyMap = new Map<string, OutstandingPartyRow>();

    filteredBills.forEach((bill) => {
        const party = bill.parties;
        if (!party) return;

        const billAmount = toMoney(bill.amount);
        const paidAmount = Math.min(paidByBillId.get(bill.id) || 0, billAmount);
        const outstanding = roundMoney(Math.max(billAmount - paidAmount, 0));
        const payStatus: OutstandingBill['pay_status'] =
            outstanding <= 0.005 ? 'paid' : paidAmount > 0.005 ? 'partial' : 'due';

        const partyBranchCode = party.branch_code;
        const partyBranchName = partyBranchCode ? (branchNameMap.get(partyBranchCode) || null) : null;

        if (!partyMap.has(party.id)) {
            partyMap.set(party.id, {
                party_id: party.id,
                party_name: party.name,
                party_code: party.code,
                party_address: formatPartyAddress(party),
                party_gstin: party.gstin ? String(party.gstin).trim() || null : null,
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
            bill_ref_no: bill.bill_ref_no,
            billing_date: bill.billing_date,
            amount: billAmount,
            paid_amount: paidAmount,
            outstanding,
            pay_status: payStatus,
        });
    });

    const result = Array.from(partyMap.values())
        .map((party) => {
            const billsAfterUnallocated = applyUnallocatedPaymentsFifo(
                party.bills,
                unallocatedByParty,
                party.party_id,
            );
            const opening = openingByParty.get(party.party_id) || 0;
            const totalBilled = roundMoney(
                billsAfterUnallocated.reduce((sum, bill) => sum + bill.amount, 0),
            );
            const totalPaid = roundMoney(
                billsAfterUnallocated.reduce((sum, bill) => sum + bill.paid_amount, 0),
            );
            const billOutstanding = roundMoney(
                billsAfterUnallocated.reduce((sum, bill) => sum + bill.outstanding, 0),
            );
            // Match party ledger: opening + billed - paid (bill-wise after FIFO unallocated).
            const totalOutstanding = roundMoney(Math.max(opening + billOutstanding, 0));

            return {
                ...party,
                bills: billsAfterUnallocated,
                total_billed: totalBilled,
                total_paid: totalPaid,
                total_outstanding: totalOutstanding,
            };
        })
        .sort((a, b) => a.party_name.localeCompare(b.party_name));

    return NextResponse.json(result);
}
