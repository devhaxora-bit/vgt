import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import pg from 'pg';

const envFile = process.argv.includes('--prod') ? '.env.production.local' : '.env.development.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const connectionString =
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL;

async function verifyColumns(supabaseUrl: string, serviceKey: string) {
    const supabase = createClient(supabaseUrl, serviceKey);
    const { error } = await supabase.from('consignments').select('parent_cn_id, freight_included').limit(1);
    return !error;
}

async function applyWithPg() {
    if (!connectionString) {
        return false;
    }

    const sql =
        fs.readFileSync(
            path.resolve(process.cwd(), 'supabase/migrations/20260601000000_add_cn_parent_child_linking.sql'),
            'utf8'
        ) + "\nNOTIFY pgrst, 'reload schema';";

    const client = new pg.Client({
        connectionString,
        ssl: { rejectUnauthorized: false },
    });

    await client.connect();
    try {
        await client.query(sql);
        console.log('Migration applied via direct Postgres connection.');
        return true;
    } finally {
        await client.end();
    }
}

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error(`Missing Supabase credentials in ${envFile}`);
        process.exit(1);
    }

    console.log(`Using env: ${envFile}`);
    console.log(`Supabase URL: ${supabaseUrl}`);

    if (await verifyColumns(supabaseUrl, serviceKey)) {
        console.log('parent_cn_id and freight_included already exist. Nothing to do.');
        return;
    }

    const applied = await applyWithPg();
    if (!applied) {
        console.error(
            '\nCould not apply migration automatically (no POSTGRES_URL / DATABASE_URL in env).\n' +
                'Run this SQL in the Supabase SQL Editor:\n' +
                '  supabase/migrations/20260601000000_add_cn_parent_child_linking.sql\n' +
                'Then run: NOTIFY pgrst, \'reload schema\';'
        );
        process.exit(1);
    }

    const ok = await verifyColumns(supabaseUrl, serviceKey);
    if (!ok) {
        console.error('Migration ran but columns are still missing. Reload schema and retry.');
        process.exit(1);
    }

    console.log('Verified: parent_cn_id and freight_included are now available.');
}

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Migration failed:', message);
    process.exit(1);
});
