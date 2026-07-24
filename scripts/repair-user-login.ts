/**
 * Diagnose / repair employee login when Admin shows Active but login fails
 * with "User profile not found".
 *
 * Root cause: public.users.id must equal auth.users.id for that login.
 * Admin only lists public.users — so a broken auth link still looks "Active".
 *
 * Diagnose:
 *   npx tsx scripts/repair-user-login.ts VZMEMP01
 *
 * Repair (re-links auth + sets password):
 *   npx tsx scripts/repair-user-login.ts VZMEMP01 --repair --password='NewPass123'
 *
 * Uses .env.local or .env.production.local (service role required).
 */
import { createClient, type User as AuthUser } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

type ProfileRow = {
    id: string;
    employee_code: string;
    full_name: string;
    role: string;
    department: string | null;
    phone: string | null;
    branch_access: string | null;
    branch_code: string | null;
    is_active: boolean;
    created_by: string | null;
};

function loadEnv(): Record<string, string> {
    const candidates = ['.env.local', '.env.production.local', '.env'];
    const envVars: Record<string, string> = { ...process.env } as Record<string, string>;

    for (const file of candidates) {
        const envPath = path.resolve(process.cwd(), file);
        if (!fs.existsSync(envPath)) continue;
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
            const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
            if (!match) continue;
            let value = match[2] || '';
            if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
            ) {
                value = value.slice(1, -1);
            }
            if (!envVars[match[1]]) envVars[match[1]] = value;
        }
    }
    return envVars;
}

async function listAllAuthUsers(supabase: ReturnType<typeof createClient>): Promise<AuthUser[]> {
    const all: AuthUser[] = [];
    let page = 1;
    for (;;) {
        const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
        if (error) throw new Error(`listUsers failed: ${error.message}`);
        all.push(...(data.users || []));
        if (!data.users || data.users.length < 200) break;
        page += 1;
    }
    return all;
}

async function main() {
    const args = process.argv.slice(2);
    const codeArg = args.find((a) => !a.startsWith('--'));
    const doRepair = args.includes('--repair');
    const passwordArg = args.find((a) => a.startsWith('--password='));
    const password = passwordArg?.slice('--password='.length);

    if (!codeArg) {
        console.error('Usage: npx tsx scripts/repair-user-login.ts <EMPLOYEE_CODE> [--repair --password=...]');
        process.exit(1);
    }

    const employeeCode = codeArg.trim().toUpperCase();
    const env = loadEnv();
    const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
    const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log(`\nDiagnosing ${employeeCode}...\n`);

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('id, employee_code, full_name, role, department, phone, branch_access, branch_code, is_active, created_by')
        .eq('employee_code', employeeCode)
        .maybeSingle();

    if (profileError) {
        console.error('Failed to load profile:', profileError.message);
        process.exit(1);
    }

    if (!profile) {
        console.error(`No public.users row with employee_code=${employeeCode}`);
        process.exit(1);
    }

    const row = profile as ProfileRow;
    console.log('Profile (public.users):');
    console.log(`  id:            ${row.id}`);
    console.log(`  full_name:     ${row.full_name}`);
    console.log(`  role:          ${row.role}`);
    console.log(`  is_active:     ${row.is_active}`);
    console.log(`  branch_access: ${row.branch_access}`);
    console.log(`  branch_code:   ${row.branch_code}`);

    const expectedEmail = `${employeeCode.toLowerCase()}@vgt.com`;
    const { data: authByIdData, error: authByIdError } = await supabase.auth.admin.getUserById(row.id);
    const authById = authByIdData?.user || null;

    console.log('\nAuth by profile id:');
    if (authByIdError || !authById) {
        console.log(`  MISSING — ${authByIdError?.message || 'no auth.users row for this id'}`);
    } else {
        console.log(`  id:    ${authById.id}`);
        console.log(`  email: ${authById.email}`);
    }

    const authUsers = await listAllAuthUsers(supabase);
    const authByEmail = authUsers.find((u) => (u.email || '').toLowerCase() === expectedEmail) || null;
    const authByCustom = authUsers.filter((u) =>
        (u.user_metadata?.employee_code || '').toUpperCase() === employeeCode
    );

    console.log(`\nAuth by expected email (${expectedEmail}):`);
    if (!authByEmail) {
        console.log('  NONE');
    } else {
        console.log(`  id:    ${authByEmail.id}`);
        console.log(`  email: ${authByEmail.email}`);
        console.log(`  match: ${authByEmail.id === row.id ? 'YES' : 'NO — THIS CAUSES "User profile not found"'}`);
    }

    if (authByCustom.length) {
        console.log('\nAuth users with matching employee_code metadata:');
        for (const u of authByCustom) {
            console.log(`  ${u.id}  ${u.email}  match=${u.id === row.id}`);
        }
    }

    const linked = Boolean(authById && authById.id === row.id);
    if (linked) {
        console.log('\nStatus: OK — profile id is linked to auth. If login still fails, the password is wrong or role on the login form does not match.');
        if (doRepair && password) {
            const { error } = await supabase.auth.admin.updateUserById(row.id, { password });
            if (error) {
                console.error('Password reset failed:', error.message);
                process.exit(1);
            }
            console.log('Password updated.');
        }
        return;
    }

    console.log('\nStatus: BROKEN — Admin can show Active, but after login auth.uid() ≠ users.id → "User profile not found".');

    if (!doRepair) {
        console.log('\nTo repair:');
        console.log(`  npx tsx scripts/repair-user-login.ts ${employeeCode} --repair --password='ChooseAPassword'`);
        process.exit(2);
    }

    if (!password) {
        console.error('--repair requires --password=...');
        process.exit(1);
    }

    console.log('\nRepairing...');

    // Clear sessions pointing at old profile id
    await supabase.from('user_sessions').delete().eq('user_id', row.id);
    // Avoid FK blocks from created_by
    await supabase.from('users').update({ created_by: null }).eq('created_by', row.id);

    let targetAuthId: string;
    let targetEmail = authById?.email || authByEmail?.email || expectedEmail;

    if (authById) {
        targetAuthId = authById.id;
        const { error } = await supabase.auth.admin.updateUserById(targetAuthId, {
            password,
            email: targetEmail,
            email_confirm: true,
            user_metadata: {
                full_name: row.full_name,
                employee_code: row.employee_code,
                role: row.role,
            },
        });
        if (error) throw new Error(`Failed to update auth: ${error.message}`);
        console.log('Auth already matched id — password refreshed.');
        return;
    }

    if (authByEmail && authByEmail.id !== row.id) {
        targetAuthId = authByEmail.id;
        targetEmail = authByEmail.email || expectedEmail;

        // Remove placeholder profile created by trigger for this auth id (if any)
        const { data: placeholder } = await supabase
            .from('users')
            .select('id, employee_code')
            .eq('id', targetAuthId)
            .maybeSingle();

        if (placeholder && placeholder.employee_code !== employeeCode) {
            console.log(`Removing placeholder profile ${placeholder.employee_code} on auth id...`);
            await supabase.from('user_sessions').delete().eq('user_id', targetAuthId);
            await supabase.from('users').update({ created_by: null }).eq('created_by', targetAuthId);
            const { error: delPh } = await supabase.from('users').delete().eq('id', targetAuthId);
            if (delPh) throw new Error(`Failed to delete placeholder profile: ${delPh.message}`);
        }

        console.log(`Re-linking profile ${employeeCode} → auth ${targetAuthId}`);
        const { error: delOld } = await supabase.from('users').delete().eq('id', row.id);
        if (delOld) throw new Error(`Failed to delete old profile row: ${delOld.message}`);

        const { error: insErr } = await supabase.from('users').insert({
            id: targetAuthId,
            employee_code: row.employee_code,
            full_name: row.full_name,
            role: row.role,
            department: row.department,
            phone: row.phone,
            branch_access: row.branch_access || 'global',
            branch_code: row.branch_code,
            is_active: row.is_active,
            created_by: null,
        });
        if (insErr) throw new Error(`Failed to insert re-linked profile: ${insErr.message}`);

        const { error: pwErr } = await supabase.auth.admin.updateUserById(targetAuthId, {
            password,
            email_confirm: true,
            user_metadata: {
                full_name: row.full_name,
                employee_code: row.employee_code,
                role: row.role,
            },
        });
        if (pwErr) throw new Error(`Failed to set password: ${pwErr.message}`);

        console.log(`\nRepaired. Login as ${employeeCode} / employee with the new password.`);
        console.log(`Auth email: ${targetEmail}`);
        return;
    }

    // No auth at all — create one, then move profile onto the new auth id
    console.log(`Creating auth user ${expectedEmail}...`);
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: expectedEmail,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: row.full_name,
            employee_code: row.employee_code,
            role: row.role,
        },
    });
    if (createErr || !created.user) {
        throw new Error(`Failed to create auth user: ${createErr?.message}`);
    }

    targetAuthId = created.user.id;
    // Trigger may have inserted a placeholder — delete it, then move real profile
    await supabase.from('user_sessions').delete().eq('user_id', targetAuthId);
    await supabase.from('users').delete().eq('id', targetAuthId);

    const { error: delOld } = await supabase.from('users').delete().eq('id', row.id);
    if (delOld) throw new Error(`Failed to delete old profile row: ${delOld.message}`);

    const { error: insErr } = await supabase.from('users').insert({
        id: targetAuthId,
        employee_code: row.employee_code,
        full_name: row.full_name,
        role: row.role,
        department: row.department,
        phone: row.phone,
        branch_access: row.branch_access || 'global',
        branch_code: row.branch_code,
        is_active: row.is_active,
        created_by: null,
    });
    if (insErr) throw new Error(`Failed to insert re-linked profile: ${insErr.message}`);

    console.log(`\nRepaired. Login as ${employeeCode} / employee with the new password.`);
    console.log(`Auth email: ${expectedEmail}`);
}

main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
});
