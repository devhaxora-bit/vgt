/**
 * Quick verification of branch-access gate helpers.
 * Run: npx tsx scripts/verify-branch-access.ts
 */
import {
    hasFullBranchAccess,
    isBranchScopedAccess,
    isBranchAdminAllowedPath,
    canAccessAdminPath,
    canAccessMasterDataPath,
    canCreateMasterData,
    canManageMasterData,
    isFullAccessEmployee,
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
const branchEmployee = { role: 'employee', branch_access: 'branch' };
const mainEmployee = { role: 'employee', branch_access: 'main' };
const globalEmployee = { role: 'employee', branch_access: 'global' };

assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/parties') === true, 'branch admin → parties');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/brokers') === true, 'branch admin → brokers');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/vehicles') === true, 'branch admin → vehicles');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/users') === false, 'branch admin ✗ users');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/branches') === false, 'branch admin ✗ branches');
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin') === false, 'branch admin ✗ hub');
assert(canAccessAdminPath(globalAdmin, '/dashboard/admin/users') === true, 'global admin → users');
assert(canAccessAdminPath(mainAdmin, '/dashboard/admin/branches') === true, 'main admin → branches');
assert(canAccessAdminPath(branchEmployee, '/dashboard/admin/parties') === false, 'branch employee ✗ admin pages');
assert(canAccessAdminPath(mainEmployee, '/dashboard/admin/parties') === false, 'main employee ✗ canAccessAdminPath');
assert(canAccessAdminPath(null, '/dashboard/admin/parties') === false, 'null ✗ admin');

assert(isFullAccessEmployee(mainEmployee) === true, 'main employee is full-access employee');
assert(isFullAccessEmployee(globalEmployee) === true, 'global employee is full-access employee');
assert(isFullAccessEmployee(branchEmployee) === false, 'branch employee is not full-access employee');
assert(isFullAccessEmployee(mainAdmin) === false, 'admin is not full-access employee');

assert(canCreateMasterData(mainEmployee) === true, 'main employee can create masters');
assert(canCreateMasterData(globalEmployee) === true, 'global employee can create masters');
assert(canCreateMasterData(branchEmployee) === false, 'branch employee ✗ create masters');
assert(canCreateMasterData(branchAdmin) === true, 'branch admin can create masters');

assert(canManageMasterData(mainEmployee) === false, 'main employee ✗ edit/delete masters');
assert(canManageMasterData(globalEmployee) === false, 'global employee ✗ edit/delete masters');
assert(canManageMasterData(mainAdmin) === true, 'main admin can edit/delete masters');

assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin/parties') === true, 'main employee → parties');
assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin/brokers') === true, 'main employee → brokers');
assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin/vehicles') === true, 'main employee → vehicles');
assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin/users') === false, 'main employee ✗ users');
assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin') === false, 'main employee ✗ hub');
assert(canAccessMasterDataPath(globalEmployee, '/dashboard/admin/parties') === true, 'global employee → parties');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin/parties') === false, 'branch employee ✗ parties path');

console.log('\n--- requireAuthz entity helpers (compile check) ---');
import {
    requirePartyBranchAccess,
    requireBrokerBranchAccess,
} from '../lib/server/requireAuthz';
assert(typeof requirePartyBranchAccess === 'function', 'requirePartyBranchAccess exported');
assert(typeof requireBrokerBranchAccess === 'function', 'requireBrokerBranchAccess exported');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
