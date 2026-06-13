import { createMiddleware } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/integrations/supabase/types'
import { verifyToken } from '@clerk/backend'

export const requireClerkAuth = createMiddleware({ type: 'function' }).server(
  async ({ next, request }) => {
    const sessionToken = request?.headers?.get?.('x-clerk-session-token')

    let userId: string | null = null

    if (sessionToken) {
      try {
        const payload = await verifyToken(sessionToken, {
          secretKey: process.env.CLERK_SECRET_KEY!,
        })
        userId = payload.sub ?? null
      } catch {
        throw new Error('Unauthorized: Invalid session token')
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
