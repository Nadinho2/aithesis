import { createMiddleware } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'

function runtimeEnv(key: string): string | undefined {
  try {
    // Use bracket notation + globalThis to prevent bundler static replacement
    const proc = (globalThis as any).process
    return proc?.env?.[key]
  } catch {
    return undefined
  }
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
        // Check if dev user has admin role in user_roles table
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

    // Dynamically import Clerk backend to avoid bundling Node.js-only code in the client
    const { verifyToken, createClerkClient } = await import('@clerk/backend')
    const clerkSecretKey = runtimeEnv('CLERK_SECRET_KEY')
    if (!clerkSecretKey) throw new Error('Missing CLERK_SECRET_KEY environment variable')
    const clerkClient = createClerkClient({ secretKey: clerkSecretKey })

    // Try header first (from client-side middleware)
    let sessionToken = request?.headers?.get?.('x-clerk-session-token')

    // Fallback: try the Clerk __session cookie (automatically sent with requests)
    if (!sessionToken) {
      const cookieHeader = request?.headers?.get?.('cookie') ?? ''
      sessionToken = cookieHeader
        .split(';')
        .map((c: string) => c.trim())
        .find((c: string) => c.startsWith('__session='))
        ?.slice('__session='.length) ?? null
    }

    let userId: string | null = null

    if (sessionToken) {
      try {
        const payload = await verifyToken(sessionToken, {
          secretKey: clerkSecretKey,
        })
        userId = payload.sub ?? null
      } catch {
        // Token invalid — will fall through to error below
      }
    }

    if (!userId) throw new Error('Unauthorized: No valid session')

    // Fetch admin status from Clerk public metadata
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
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    )

    return next({
      context: {
        supabase,
        userId,
        isAdmin,
      },
    })
  },
)
