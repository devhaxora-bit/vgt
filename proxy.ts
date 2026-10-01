import { NextResponse, type NextRequest } from 'next/server'
import {
    BRANCH_ADMIN_ALLOWED_PATHS,
    canAccessMasterDataPath,
    isBranchScopedAccess,
} from '@/lib/branchAccess'
import {
    APP_SESSION_COOKIE,
    appSessionCookieOptions,
    lookupAppSession,
    type AppSessionLookup,
} from '@/lib/auth/appSession'

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

function redirectTo(request: NextRequest, pathname: string) {
    const url = request.nextUrl.clone()
    url.pathname = pathname
    url.search = ''
    return NextResponse.redirect(url)
}

export async function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // API routes authenticate themselves (requireAuthz / getSessionUser).
    if (pathname.startsWith('/api/')) {
        return NextResponse.next()
    }

    const token = request.cookies.get(APP_SESSION_COOKIE)?.value || ''
    const lookup: AppSessionLookup = token
        ? await lookupAppSession(token, { slide: true })
        : { status: 'invalid' }
    const session = lookup.status === 'valid' ? lookup.session : null
    const profile = session?.profile ?? null

    // Only a definitely-invalid session goes to /login. If the session store is
    // unreachable, let the request through rather than logging the user out.
    if (pathname.startsWith('/dashboard') && lookup.status === 'invalid') {
        const response = redirectTo(request, '/login')
        if (token) response.cookies.delete(APP_SESSION_COOKIE)
        return response
    }

    if ((pathname === '/login' || pathname === '/') && session) {
        return redirectTo(request, '/dashboard')
    }

    if (profile && pathname.startsWith('/dashboard/admin') && !canAccessMasterDataPath(profile, pathname)) {
        return redirectTo(
            request,
            canAccessMasterDataPath(profile, BRANCH_ADMIN_ALLOWED_PATHS[0])
                ? BRANCH_ADMIN_ALLOWED_PATHS[0]
                : '/dashboard',
        )
    }

    const response = NextResponse.next()
    if (lookup.status === 'valid' && lookup.renewedMaxAgeSec) {
        response.cookies.set(APP_SESSION_COOKIE, token, appSessionCookieOptions(lookup.renewedMaxAgeSec))
    }

    return withBranchHeaders(response, profile)
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
