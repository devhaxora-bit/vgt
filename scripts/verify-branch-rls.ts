/**
 * Verify Phase 3 branch RLS migration is present.
 * Run: npx tsx scripts/verify-branch-rls.ts
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

const migration = join(
    process.cwd(),
    'supabase/migrations/20260715180000_branch_scoped_rls.sql',
);
assert(existsSync(migration), 'migration file exists');

const sql = readFileSync(migration, 'utf8');
assert(sql.includes('can_access_branch'), 'helper can_access_branch');
assert(sql.includes('current_user_has_full_branch_access'), 'helper full access');
assert(sql.includes('parties_select_branch'), 'parties RLS');
assert(sql.includes('brokers_select_branch'), 'brokers RLS');
assert(sql.includes('vehicles_select_branch'), 'vehicles RLS');
assert(sql.includes('consignments_select_branch'), 'consignments RLS');
assert(sql.includes('challans_select_branch'), 'challans RLS');
assert(sql.includes('pbr_select_branch'), 'party bills RLS');
assert(sql.includes('ppr_select_branch'), 'party payments RLS');
assert(sql.includes('bcbr_select_branch'), 'broker bills RLS');
assert(sql.includes('bcpr_select_branch'), 'broker payments RLS');
assert(sql.includes('security_invoker = true'), 'views security_invoker');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
console.log('\nApply in Supabase SQL Editor:');
console.log('  supabase/migrations/20260715180000_branch_scoped_rls.sql');
if (failed > 0) process.exit(1);
