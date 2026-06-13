import { createMiddleware } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { verifyToken } from '@clerk/backend'

export const requireClerkAuth = createMiddleware({ type: 'function' }).server(
  async ({ next, request }) => {
    // Try header first (from client-side middleware)
    let sessionToken = request?.headers?.get?.('x-clerk-session-token')

    // Fallback: try the Clerk __session cookie (automatically sent with requests)
    if (!sessionToken) {
      const cookieHeader = request?.headers?.get?.('cookie') ?? ''
      sessionToken = cookieHeader
        .split(';')
        .map((c) => c.trim())
        .find((c) => c.startsWith('__session='))
        ?.slice('__session='.length) ?? null
    }

    let userId: string | null = null

    if (sessionToken) {
      try {
        const payload = await verifyToken(sessionToken, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        })
        userId = payload.sub ?? null
      } catch {
        // Token invalid — will fall through to error below
      }
    }

    if (!userId) throw new Error('Unauthorized: No valid session')

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing Supabase environment variables')
    }

    const supabase = createClient<Database>(
      SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY,
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
      },
    })
  },
)
