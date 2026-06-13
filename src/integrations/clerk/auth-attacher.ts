import { createMiddleware } from '@tanstack/react-start'

/**
 * Client-side middleware that attaches the Clerk session token to server fn requests.
 * Uses window.Clerk (set globally by <ClerkProvider>) — no React hooks needed.
 * Registered as a global `functionMiddleware` in `src/start.ts`.
 */
export const attachClerkAuth = createMiddleware({ type: 'function' }).client(
  async ({ next }) => {
    let token: string | null = null
    try {
      const clerk = (window as any).Clerk
      if (clerk?.session) {
        token = await clerk.session.getToken()
      }
    } catch {
      // Clerk not yet loaded — continue without token
    }
    return next({
      headers: token ? { 'x-clerk-session-token': token } : {},
    })
  },
)
