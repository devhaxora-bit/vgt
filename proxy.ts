import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
    BRANCH_ADMIN_ALLOWED_PATHS,
    canAccessMasterDataPath,
    isBranchScopedAccess,
} from '@/lib/branchAccess'
import { withSessionCookieOptions } from '@/lib/auth/sessionCookie'

const BRANCH_SCOPE_HEADER = 'x-vgt-branch-scope'
const BRANCH_CODE_HEADER = 'x-vgt-branch-code'
const BRANCH_ROLE_HEADER = 'x-vgt-role'

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
                        supabaseResponse.cookies.set(
                            name,
                            value,
                            // Keep refreshed cookies long-lived so users are not forced to re-login daily.
                            withSessionCookieOptions(options, true),
                        )
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

    // Restrict /dashboard/admin to allowed admin / master-data paths
    if (
        user &&
        profile &&
        pathname.startsWith('/dashboard/admin') &&
        !canAccessMasterDataPath(profile, pathname)
    ) {
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = canAccessMasterDataPath(profile, BRANCH_ADMIN_ALLOWED_PATHS[0])
            ? BRANCH_ADMIN_ALLOWED_PATHS[0]
            : '/dashboard'
        redirectUrl.search = ''
        return NextResponse.redirect(redirectUrl)
    }

    // Branch scope is enforced in requireAuthz (resolveListBranch / forbidIfForeignBranch).
    // Do NOT rewrite API URLs here: NextResponse.rewrite without forwarding the mutated
    // request + full cookie options corrupts refreshed auth cookies and logs operators
    // out when Finance pages hit /api/ledger/* without ?branch=.

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
