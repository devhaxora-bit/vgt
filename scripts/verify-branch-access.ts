/**
 * Quick verification of branch-access gate helpers.
 * Run: npx tsx scripts/verify-branch-access.ts
 */
import {
    hasFullBranchAccess,
    isBranchScopedAccess,
    isBranchAdminAllowedPath,
    canAccessAdminPath,
} from '../lib/branchAccess';

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

assert(hasFullBranchAccess({ branch_access: 'global' }) === true, 'global has full access');
assert(hasFullBranchAccess({ branch_access: 'main' }) === true, 'main has full access');
assert(hasFullBranchAccess({ branch_access: 'branch' }) === false, 'branch does NOT have full access');
assert(hasFullBranchAccess({}) === true, 'missing defaults to global = full');
assert(hasFullBranchAccess(null) === true, 'null defaults to global = full');

assert(isBranchScopedAccess({ branch_access: 'branch' }) === true, 'branch is scoped');
assert(isBranchScopedAccess({ branch_access: 'global' }) === false, 'global is not scoped');
assert(isBranchScopedAccess({ branch_access: 'main' }) === false, 'main is not scoped');

assert(isBranchAdminAllowedPath('/dashboard/admin/parties') === true, 'parties allowed');
assert(isBranchAdminAllowedPath('/dashboard/admin/brokers') === true, 'brokers allowed');
assert(isBranchAdminAllowedPath('/dashboard/admin/vehicles') === true, 'vehicles allowed');
assert(isBranchAdminAllowedPath('/dashboard/admin/vehicles/') === true, 'vehicles trailing slash');
assert(isBranchAdminAllowedPath('/dashboard/admin/users') === false, 'users blocked');
assert(isBranchAdminAllowedPath('/dashboard/admin/branches') === false, 'branches blocked');
assert(isBranchAdminAllowedPath('/dashboard/admin') === false, 'admin hub blocked');
assert(isBranchAdminAllowedPath('/dashboard/admin/parties?x=1') === true, 'parties with query');

const branchAdmin = { role: 'admin', branch_access: 'branch' };
const globalAdmin = { role: 'admin', branch_access: 'global' };
const mainAdmin = { role: 'admin', branch_access: 'main' };
const employee = { role: 'employee', branch_access: 'branch' };

assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/parties') === true, 'branch admin → parties');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/brokers') === true, 'branch admin → brokers');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/vehicles') === true, 'branch admin → vehicles');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/users') === false, 'branch admin ✗ users');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/branches') === false, 'branch admin ✗ branches');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin') === false, 'branch admin ✗ hub');
assert(canAccessAdminPath(globalAdmin, '/dashboard/admin/users') === true, 'global admin → users');
assert(canAccessAdminPath(mainAdmin, '/dashboard/admin/branches') === true, 'main admin → branches');
assert(canAccessAdminPath(employee, '/dashboard/admin/parties') === false, 'employee ✗ admin pages');
assert(canAccessAdminPath(null, '/dashboard/admin/parties') === false, 'null ✗ admin');

console.log('\n--- requireAuthz entity helpers (compile check) ---');
import {
    requirePartyBranchAccess,
    requireBrokerBranchAccess,
} from '../lib/server/requireAuthz';
assert(typeof requirePartyBranchAccess === 'function', 'requirePartyBranchAccess exported');
assert(typeof requireBrokerBranchAccess === 'function', 'requireBrokerBranchAccess exported');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
