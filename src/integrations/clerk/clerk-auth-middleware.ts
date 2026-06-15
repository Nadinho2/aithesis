import { createMiddleware } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { env } from '@/lib/config.server'

export const requireClerkAuth = createMiddleware({ type: 'function' }).server(
  // @ts-expect-error — 'request' exists at runtime but isn't in FunctionMiddlewareServerFn types
  async ({ next, request }) => {
    // Dynamically import Clerk backend to avoid bundling Node.js-only code in the client
    const { verifyToken, createClerkClient } = await import('@clerk/backend')
    const clerkClient = createClerkClient({ secretKey: env('CLERK_SECRET_KEY')! })

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
          secretKey: env('CLERK_SECRET_KEY')!,
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

    const supabaseUrl = env('SUPABASE_URL')
    const supabaseServiceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables')
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
