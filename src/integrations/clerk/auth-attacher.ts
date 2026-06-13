import { createMiddleware } from '@tanstack/react-start'
import { useAuth } from '@clerk/clerk-react'

/**
 * Client-side middleware that attaches the Clerk session token to server fn requests.
 * Registered as a global `functionMiddleware` in `src/start.ts`.
 */
export const attachClerkAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const { getToken } = useAuth()
    const token = await getToken()
    return next({
      headers: token ? { 'x-clerk-session-token': token } : {},
    })
  },
)
