import fs from 'fs';

const envText = fs.readFileSync('.env.development.local', 'utf8');
const getEnv = (key) => {
    const line = envText.split('\n').find((row) => row.startsWith(`${key}=`) && !row.trimStart().startsWith('#'));
    if (!line) return null;
    return line.slice(key.length + 1).trim().replace(/^"|"$/g, '');
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.development.local');
    process.exit(1);
}

const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
};

async function canSelect(path) {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (response.ok) return true;
    const body = await response.json().catch(() => ({}));
    const message = String(body.message || body.error || response.statusText || '');
    return false;
}

async function tableMissing(path) {
    const response = await fetch(`${url}/rest/v1/${path}`, { headers });
    if (response.status === 404) return true;
    const body = await response.json().catch(() => ({}));
    const code = String(body.code || '');
    const message = String(body.message || '');
    return code === 'PGRST205' || message.includes('Could not find the table');
}

const migrations = [
    {
        file: '20260601000000_add_cn_parent_child_linking.sql',
        check: () => canSelect('consignments?select=parent_cn_id,freight_included&limit=1'),
    },
    {
        file: '20260602120000_create_broker_challan_ledger_schema.sql',
        check: () => canSelect('broker_ledger_accounts?select=id&limit=1'),
    },
    {
        file: '20260606000100_head_branch_and_range_validation.sql',
        check: () => canSelect('branches?select=is_head_branch&limit=1'),
    },
    {
        file: '20260606000200_remove_physical_cn_reservations.sql',
        check: () => tableMissing('branch_cn_reserved_ranges?select=id&limit=1'),
    },
    {
        file: '20260606000300_add_cn_range_assigned_by.sql',
        check: () => canSelect('branch_cn_ranges?select=assigned_by&limit=1'),
    },
    {
        file: '20260606000400_add_vehicle_cancel_items_to_billing.sql',
        check: () => canSelect('party_billing_records?select=vehicle_cancel_items,vehicle_cancel_charges_total&limit=1'),
    },
];

console.log(`Prod project: ${url.replace('https://', '').replace('.supabase.co', '')}`);
console.log('---');

const results = [];
for (const migration of migrations) {
    const applied = await migration.check();
    results.push({ ...migration, applied });
    console.log(`${applied ? 'APPLIED' : 'MISSING'}  ${migration.file}`);
}

console.log('---');
console.log('Need to run:');
const pending = results.filter((item) => !item.applied);
if (pending.length === 0) {
    console.log('None — all development-only migrations appear applied.');
} else {
    pending.forEach((item) => console.log(`- ${item.file}`));
}
