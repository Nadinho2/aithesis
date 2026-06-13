import { createMiddleware } from '@tanstack/react-start'
import { getToken } from '@clerk/tanstack-react-start'

/**
 * Client-side middleware that attaches the Clerk session token to server fn requests.
 * Registered as a global `functionMiddleware` in `src/start.ts`.
 */
export const attachClerkAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    const token = await getToken()
    return next({
      headers: token ? { 'x-clerk-session-token': token } : {},
    })
  },
)
