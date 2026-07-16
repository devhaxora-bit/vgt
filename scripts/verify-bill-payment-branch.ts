/**
 * Sanity helpers for bill/payment branch stamping.
 * Run: npx tsx scripts/verify-bill-payment-branch.ts
 *
 * Live DB counts need SUPABASE credentials; this script always checks
 * the migration file + API stamp patterns exist.
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

let passed = 0;
let failed = 0;

function assert(cond: boolean, msg: string) {
    if (cond) {
        passed += 1;
        console.log('PASS:', msg);
    } else {
        failed += 1;
        console.error('FAIL:', msg);
    }
}

const root = process.cwd();
const migration = join(root, 'supabase/migrations/20260715170000_bill_payment_branch_code.sql');
assert(existsSync(migration), 'migration file exists');

const sql = readFileSync(migration, 'utf8');
assert(sql.includes('party_billing_records'), 'migration covers party_billing_records');
assert(sql.includes('party_payment_receipts'), 'migration covers party_payment_receipts');
assert(sql.includes('broker_challan_billing_records'), 'migration covers broker_challan_billing_records');
assert(sql.includes('broker_challan_payment_receipts'), 'migration covers broker_challan_payment_receipts');
assert(sql.includes('FROM public.parties'), 'backfill joins parties');
assert(sql.includes('FROM public.brokers'), 'backfill joins brokers');
assert(sql.includes('Branch cannot be changed'), 'immutability triggers present');

const partyBill = readFileSync(join(root, 'app/api/ledger/[partyId]/billing/route.ts'), 'utf8');
const partyPay = readFileSync(join(root, 'app/api/ledger/[partyId]/payments/route.ts'), 'utf8');
const brokerBill = readFileSync(join(root, 'app/api/challan-ledger/[brokerId]/billing/route.ts'), 'utf8');
const brokerPay = readFileSync(join(root, 'app/api/challan-ledger/[brokerId]/payments/route.ts'), 'utf8');

assert(partyBill.includes('branch_code: partyAccess.entity.branch_code'), 'party bill create stamps branch_code');
assert(partyPay.includes('branch_code: partyAccess.entity.branch_code'), 'party payment create stamps branch_code');
assert(brokerBill.includes('branch_code: brokerAccess.entity.branch_code'), 'broker bill create stamps branch_code');
assert(brokerPay.includes('branch_code: brokerAccess.entity.branch_code'), 'broker payment create stamps branch_code');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
