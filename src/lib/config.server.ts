import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Vercel, process.env should contain dashboard env vars at runtime.
// However, Vite may inline some process.env references during build.
// This helper prefers runtime values (process.env) and falls back
// to build-time values (import.meta.env) for maximum compatibility.
function env(key: string): string | undefined {
  // @ts-expect-error — import.meta.env is available in Vite builds
  return process.env[key] ?? (typeof import.meta !== 'undefined' ? import.meta.env[key] : undefined);
}

export function getServerConfig() {
  return {
    nodeEnv: env('NODE_ENV'),
    supabaseUrl: env('SUPABASE_URL'),
    supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY'),
    clerkSecretKey: env('CLERK_SECRET_KEY'),
  };
}

export { env };
