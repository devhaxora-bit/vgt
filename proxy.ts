import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
    BRANCH_ADMIN_ALLOWED_PATHS,
    canAccessAdminPath,
    hasFullBranchAccess,
    isBranchScopedAccess,
} from '@/lib/branchAccess'

const BRANCH_SCOPE_HEADER = 'x-vgt-branch-scope'
const BRANCH_CODE_HEADER = 'x-vgt-branch-code'
const BRANCH_ROLE_HEADER = 'x-vgt-role'

/** Query params used by list UIs that imply a branch filter — force for scoped users */
const BRANCH_QUERY_KEYS = ['branch', 'booking_branch', 'origin_branch', 'origin_branch_code'] as const

function withBranchHeaders(
    response: NextResponse,
    profile: { role?: string | null; branch_access?: string | null; branch_code?: string | null } | null,
) {
    if (!profile) return response

    const scoped = isBranchScopedAccess(profile)
    const branchCode = String(profile.branch_code || '').trim().toUpperCase()

    response.headers.set(BRANCH_SCOPE_HEADER, scoped ? 'branch' : 'full')
    response.headers.set(BRANCH_ROLE_HEADER, String(profile.role || ''))
    if (scoped && branchCode) {
        response.headers.set(BRANCH_CODE_HEADER, branchCode)
    }
    return response
}

function forceBranchQueryParams(request: NextRequest, branchCode: string): URL | null {
    const url = request.nextUrl.clone()
    let changed = false

    for (const key of BRANCH_QUERY_KEYS) {
        const current = url.searchParams.get(key)
        if (current !== null && current.trim().toUpperCase() !== branchCode) {
            url.searchParams.set(key, branchCode)
            changed = true
        }
    }

    // If scoped user hits a list API without branch, inject it for known list endpoints
    const path = url.pathname
    const isListApi =
        path.startsWith('/api/consignments') ||
        path.startsWith('/api/challans') ||
        path.startsWith('/api/ledger') ||
        path.startsWith('/api/challan-ledger') ||
        path.startsWith('/api/query') ||
        path.startsWith('/api/brokers') ||
        path.startsWith('/api/vehicles') ||
        path.startsWith('/api/parties')

    if (isListApi && request.method === 'GET' && !url.searchParams.has('branch')) {
        url.searchParams.set('branch', branchCode)
        changed = true
    }

    return changed ? url : null
}

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({
        request,
    })

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value)
                    })
                    supabaseResponse = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    )
                },
            },
        }
    )

    // Refresh session if expired - this is critical for maintaining auth state
    const { data: { user } } = await supabase.auth.getUser()

    // Protected routes - redirect to login if not authenticated
    const protectedRoutes = ['/dashboard']
    const isProtectedRoute = protectedRoutes.some(route =>
        request.nextUrl.pathname.startsWith(route)
    )

    if (isProtectedRoute && !user) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/login'
        return NextResponse.redirect(redirectUrl)
    }

    // Redirect authenticated users away from login
    if (request.nextUrl.pathname === '/login' && user) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
    }

    // Keep authenticated users inside app shell instead of the template home page
    if (request.nextUrl.pathname === '/' && user) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        return NextResponse.redirect(redirectUrl)
    }

    let profile: {
        role: string | null
        branch_access: string | null
        branch_code: string | null
    } | null = null

    if (user) {
        const { data } = await supabase
            .from('users')
            .select('role, branch_access, branch_code')
            .eq('id', user.id)
            .maybeSingle()

        profile = data
    }

    const pathname = request.nextUrl.pathname

    // Branch admin — block System Admin pages they shouldn't open by URL
    if (
        user &&
        profile &&
        pathname.startsWith('/dashboard/admin') &&
        !canAccessAdminPath(profile, pathname)
    ) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = BRANCH_ADMIN_ALLOWED_PATHS[0]
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl)
    }

    // Non-admin cannot open /dashboard/admin at all
    if (
        user &&
        profile &&
        pathname.startsWith('/dashboard/admin') &&
        String(profile.role || '').toLowerCase() !== 'admin'
    ) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/dashboard'
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl)
    }

    // Branch-scoped: rewrite query params that try to widen to another branch
    if (
        user &&
        profile &&
        isBranchScopedAccess(profile) &&
        !hasFullBranchAccess(profile)
    ) {
        const branchCode = String(profile.branch_code || '').trim().toUpperCase()
        if (branchCode) {
            const forced = forceBranchQueryParams(request, branchCode)
            if (forced) {
                const rewriteResponse = NextResponse.rewrite(forced)
                // preserve auth cookies from supabaseResponse
                supabaseResponse.cookies.getAll().forEach((cookie) => {
                    rewriteResponse.cookies.set(cookie.name, cookie.value)
                })
                return withBranchHeaders(rewriteResponse, profile)
            }
        }
    }

    return withBranchHeaders(supabaseResponse, profile)
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - images, svg, png, jpg, jpeg, gif, webp (static assets)
         */
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
