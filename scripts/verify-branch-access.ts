/**
 * Quick verification of branch-access gate helpers.
 * Run: npx tsx scripts/verify-branch-access.ts
 * Or:  node --import tsx scripts/verify-branch-access.ts
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
    isBranchEmployee,
    isEmployee,
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
assert(canAccessAdminPath(branchAdmin, '/dashboard/admin/users') === false, 'branch admin ✗ users');
assert(canAccessAdminPath(globalAdmin, '/dashboard/admin/users') === true, 'global admin → users');
assert(canAccessAdminPath(mainAdmin, '/dashboard/admin/branches') === true, 'main admin → branches');
assert(canAccessAdminPath(branchEmployee, '/dashboard/admin/parties') === false, 'branch employee ✗ canAccessAdminPath');
assert(canAccessAdminPath(mainEmployee, '/dashboard/admin/parties') === false, 'main employee ✗ canAccessAdminPath');

assert(isEmployee(branchEmployee) === true, 'branch employee is employee');
assert(isFullAccessEmployee(mainEmployee) === true, 'main employee is full-access employee');
assert(isFullAccessEmployee(globalEmployee) === true, 'global employee is full-access employee');
assert(isFullAccessEmployee(branchEmployee) === false, 'branch employee is not full-access employee');
assert(isBranchEmployee(branchEmployee) === true, 'branch employee is branch employee');
assert(isBranchEmployee(mainEmployee) === false, 'main employee is not branch employee');

assert(canCreateMasterData(mainEmployee) === true, 'main employee can create masters');
assert(canCreateMasterData(globalEmployee) === true, 'global employee can create masters');
assert(canCreateMasterData(branchEmployee) === true, 'branch employee can create masters');
assert(canCreateMasterData(branchAdmin) === true, 'branch admin can create masters');

assert(canManageMasterData(mainEmployee) === false, 'main employee ✗ edit/delete');
assert(canManageMasterData(branchEmployee) === false, 'branch employee ✗ edit/delete');
assert(canManageMasterData(mainAdmin) === true, 'main admin can edit/delete');

assert(canAccessMasterDataPath(mainEmployee, '/dashboard/admin/parties') === true, 'main employee → parties');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin/parties') === true, 'branch employee → parties');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin/brokers') === true, 'branch employee → brokers');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin/vehicles') === true, 'branch employee → vehicles');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin/users') === false, 'branch employee ✗ users');
assert(canAccessMasterDataPath(branchEmployee, '/dashboard/admin') === false, 'branch employee ✗ hub');
assert(canAccessMasterDataPath(globalEmployee, '/dashboard/admin/parties') === true, 'global employee → parties');

console.log('\n--- requireAuthz entity helpers (compile check) ---');
import {
    requirePartyBranchAccess,
    requireBrokerBranchAccess,
} from '../lib/server/requireAuthz';
assert(typeof requirePartyBranchAccess === 'function', 'requirePartyBranchAccess exported');
assert(typeof requireBrokerBranchAccess === 'function', 'requireBrokerBranchAccess exported');

console.log(`\nResult: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
