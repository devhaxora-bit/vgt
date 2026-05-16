import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const TEST_EMAIL = 'admin@vgt.com';
const TEST_PASSWORD = 'Admin@123';
const API_BASE = process.env.API_BASE || 'http://localhost:3000';

async function main() {
    console.log(`Signing in as ${TEST_EMAIL}...`);
    const supabase = createClient(supabaseUrl, anonKey);
    const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
    });

    if (signInErr || !signIn.session) {
        console.error('Sign-in failed:', signInErr?.message);
        process.exit(1);
    }

    const accessToken = signIn.session.access_token;
    const refreshToken = signIn.session.refresh_token;
    console.log(`Signed in. Access token: ${accessToken.slice(0, 20)}...`);

    // Build the sb-<ref>-auth-token cookie that @supabase/ssr v0.8 expects.
    // Format: name "sb-<ref>-auth-token", value "base64-<b64-encoded-session-json>",
    // chunked across .0/.1/... if it exceeds ~3180 bytes per cookie.
    const ref = supabaseUrl.replace('https://', '').split('.')[0];
    const cookieBaseName = `sb-${ref}-auth-token`;
    const sessionJson = JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: signIn.session.expires_at,
        expires_in: signIn.session.expires_in,
        token_type: 'bearer',
        user: signIn.user,
    });
    const encoded = 'base64-' + Buffer.from(sessionJson).toString('base64');
    const CHUNK = 3180;
    const chunks: string[] = [];
    for (let i = 0; i < encoded.length; i += CHUNK) chunks.push(encoded.slice(i, i + CHUNK));
    const cookieHeader = chunks
        .map((c, i) => `${cookieBaseName}.${i}=${c}`)
        .join('; ');

    const terms = ['501', '5019', '50', '2899', '9', 'xyz_nomatch'];
    for (const term of terms) {
        const url = `${API_BASE}/api/consignments/by-cn?search=${encodeURIComponent(term)}`;
        const res = await fetch(url, {
            headers: {
                cookie: cookieHeader,
            },
        });
        const body = await res.text();
        let parsed: any;
        try { parsed = JSON.parse(body); } catch { parsed = body; }

        if (Array.isArray(parsed)) {
            console.log(`\nsearch="${term}" → status=${res.status}  ${parsed.length} results`);
            parsed.slice(0, 5).forEach((r: any, i: number) =>
                console.log(`  ${i + 1}. cn_no="${r.cn_no}"  load="${r.loading_point ?? ''}"  dest="${r.delivery_point ?? r.dest_branch ?? ''}"`)
            );
            if (parsed.length > 5) console.log(`  ... and ${parsed.length - 5} more`);
        } else {
            console.log(`\nsearch="${term}" → status=${res.status}  body=${JSON.stringify(parsed)}`);
        }
    }
}

main().catch(console.error);
