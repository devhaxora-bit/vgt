import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAuthz } from '@/lib/server/requireAuthz';
import type { AuthLoginAttempt } from '@/lib/types/authLoginAttempt.types';

const dateFilterSchema = z
    .string()
    .trim()
    .min(1)
    .refine(
        (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
        'Invalid date',
    )
    .optional();

const querySchema = z.object({
    success: z.enum(['true', 'false', 'all']).optional().default('all'),
    employee_code: z.string().trim().min(1).optional(),
    q: z.string().trim().min(1).optional(),
    from: dateFilterSchema,
    to: dateFilterSchema,
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
});

type UserRow = { id: string; full_name: string | null; employee_code: string | null };

const toInclusiveEndIso = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T23:59:59.999Z`;
    }
    return value;
};

const toStartIso = (value: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return `${value}T00:00:00.000Z`;
    }
    return value;
};

// GET /api/admin/login-attempts
export async function GET(request: NextRequest) {
    const auth = await requireAuthz({ adminOnly: true, fullAccessOnly: true });
    if (!auth.ok) return auth.response;

    const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams.entries()));
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid query' }, { status: 400 });
    }

    const { success, employee_code, q, from, to, limit } = parsed.data;

    let query = auth.supabase
        .from('auth_login_attempts')
        .select('id, occurred_at, employee_code, role, success, failure_reason, user_id, ip_address, user_agent')
        .order('occurred_at', { ascending: false })
        .limit(limit);

    if (success === 'true') query = query.eq('success', true);
    if (success === 'false') query = query.eq('success', false);
    if (employee_code) query = query.ilike('employee_code', employee_code);
    if (q) query = query.or(`employee_code.ilike.%${q}%,failure_reason.ilike.%${q}%`);
    if (from) query = query.gte('occurred_at', toStartIso(from));
    if (to) query = query.lte('occurred_at', toInclusiveEndIso(to));

    const { data, error } = await query;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
    const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
    const usersRes = userIds.length
        ? await auth.supabase.from('users').select('id, full_name, employee_code').in('id', userIds)
        : { data: [] as UserRow[], error: null };

    const userById = new Map<string, UserRow>();
    for (const user of (usersRes.data || []) as UserRow[]) {
        userById.set(user.id, user);
    }

    const enriched: AuthLoginAttempt[] = rows.map((row) => {
        const user = row.user_id ? userById.get(row.user_id) : undefined;
        return {
            id: row.id,
            occurred_at: row.occurred_at,
            employee_code: row.employee_code,
            role: row.role,
            success: Boolean(row.success),
            failure_reason: row.failure_reason,
            user_id: row.user_id,
            user_name: user?.full_name ?? null,
            user_code: user?.employee_code ?? null,
            ip_address: row.ip_address ? String(row.ip_address) : null,
            user_agent: row.user_agent,
        };
    });

    return NextResponse.json({ success: true, data: enriched });
}
