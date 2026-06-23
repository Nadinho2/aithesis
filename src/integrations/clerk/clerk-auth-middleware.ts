import { createMiddleware } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

function runtimeEnv(key: string): string | undefined {
  try {
    const proc = (globalThis as any).process
    return proc?.env?.[key]
  } catch {
    return undefined
  }
}

/**
 * Extract a header value from an unknown headers object.
 * Handles both standard Headers objects (with .get()) and plain objects.
 */
function getHeader(headers: unknown, name: string): string | null {
  if (!headers) return null
  // Standard Headers API
  if (typeof (headers as any).get === 'function') {
    return (headers as any).get(name) ?? null
  }
  // Plain object (e.g. IncomingMessage.headers)
  const val = (headers as Record<string, any>)[name]
  if (Array.isArray(val)) return val[0] ?? null
  return val ?? null
}

/**
 * Extract the Clerk session token from a cookie string.
 * Clerk uses '__session' as the default cookie name.
 */
function extractSessionFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  // Try __session first, then __clerk_db_jwt as fallback
  for (const name of ['__session', '__clerk_db_jwt']) {
    const match = cookieHeader.match(new RegExp(`${name}=([^;]+)`))
    if (match) return match[1]
  }
  return null
}

export const requireClerkAuth = createMiddleware({ type: 'function' }).server(
  // @ts-expect-error — 'request' exists at runtime but isn't in FunctionMiddlewareServerFn types
  async ({ next, request }) => {
    // TEMPORARY: Skip auth when DISABLE_AUTH env var is set
    if (runtimeEnv('DISABLE_AUTH') === 'true') {
      const supabaseUrl = runtimeEnv('SUPABASE_URL')
      const supabaseServiceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')
      const devUserId = runtimeEnv('DISABLE_AUTH_USER_ID') || 'dev-user-id'
      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabase = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        const { data: roleRow } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", devUserId)
          .eq("role", "admin")
          .maybeSingle()
        return next({
          context: { supabase, userId: devUserId, isAdmin: !!roleRow },
        })
      }
    }

    // Parse headers, supporting both Headers API and plain-object headers
    const headers = (request as any)?.headers ?? {}

    // 1. Try custom header from client-side auth-attacher middleware
    let sessionToken = getHeader(headers, 'x-clerk-session-token')

    // 2. Try Authorization Bearer header
    if (!sessionToken) {
      const authHeader = getHeader(headers, 'authorization')
      if (authHeader?.startsWith('Bearer ')) {
        sessionToken = authHeader.slice(7)
      }
    }

    // 3. Fallback to Clerk __session cookie
    if (!sessionToken) {
      const cookieHeader = getHeader(headers, 'cookie')
      sessionToken = extractSessionFromCookies(cookieHeader)
    }

    if (!sessionToken) {
      console.warn('[requireClerkAuth] No session token found in headers, authorization header, or cookies')
      throw new Error('Unauthorized: No valid session')
    }

    const { verifyToken, createClerkClient } = await import('@clerk/backend')
    const clerkSecretKey = runtimeEnv('CLERK_SECRET_KEY')
    if (!clerkSecretKey) throw new Error('Missing CLERK_SECRET_KEY environment variable')
    const clerkClient = createClerkClient({ secretKey: clerkSecretKey })

    let userId: string | null = null
    try {
      const payload = await verifyToken(sessionToken, { secretKey: clerkSecretKey })
      userId = payload.sub ?? null
    } catch (err) {
      console.warn('[requireClerkAuth] Session token verification failed:', (err as any)?.message ?? err)
      throw new Error('Unauthorized: No valid session')
    }

    if (!userId) throw new Error('Unauthorized: No valid session')

    let isAdmin = false
    try {
      const clerkUser = await clerkClient.users.getUser(userId)
      isAdmin = clerkUser.publicMetadata?.role === 'admin'
    } catch {
      // Clerk unavailable — fall back to non-admin
    }

    const supabaseUrl = runtimeEnv('SUPABASE_URL')
    const supabaseServiceRoleKey = runtimeEnv('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      const errMsg = [
        'Missing Supabase env vars',
        `SUPABASE_URL: ${supabaseUrl ? 'set' : 'MISSING'}`,
        `SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceRoleKey ? 'set' : 'MISSING'}`,
        `NODE_ENV: ${runtimeEnv('NODE_ENV')}`,
      ].join(' | ')
      console.error('[requireClerkAuth]', errMsg)
      throw new Error(errMsg)
    }

    const supabase = createClient<Database>(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    return next({ context: { supabase, userId, isAdmin } })
  },
)
