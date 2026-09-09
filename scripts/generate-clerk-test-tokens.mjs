#!/usr/bin/env node
/**
 * Generate Clerk test-user session tokens for k6 load testing.
 *
 * Mechanism (Clerk Backend API):
 *   1. users.createUser()                 -> create a test user
 *   2. sessions.createSession({ userId }) -> create an active session WITHOUT a
 *                                            real sign-in (TESTING-ONLY endpoint)
 *   3. sessions.getToken(sessionId)       -> mint the default session token (JWT)
 *
 * The resulting JWT is a real Clerk-signed session token, so it passes the app's
 * `verifyToken(token, { secretKey })` check in requireClerkAuth / api/chat.
 *
 * IMPORTANT LIMITATION:
 *   sessions.createSession() is available ONLY on development (and staging)
 *   instances. Clerk blocks it on production instances. Load-test against a
 *   dev/staging instance, not production.
 *
 * Usage:
 *   CLERK_SECRET_KEY=sk_test_... COUNT=50 node scripts/generate-clerk-test-tokens.mjs
 *   # writes loadtest/tokens.json by default
 *
 * Env vars:
 *   CLERK_SECRET_KEY  (required) secret key of the DEV/STAGING instance
 *   COUNT             number of users/tokens to create (default 30)
 *   EMAIL_DOMAIN      email domain for test users (default example.com)
 *   TOKEN_TTL_SECS    session token lifetime in seconds (default 3600)
 *   DELAY_MS          pause between users to stay under rate limits (default 100)
 *   OUT               output JSON path (default loadtest/tokens.json)
 */

import { createClerkClient } from "@clerk/backend";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("ERROR: CLERK_SECRET_KEY is required.");
  console.error("Usage: CLERK_SECRET_KEY=sk_test_... COUNT=50 node scripts/generate-clerk-test-tokens.mjs");
  process.exit(1);
}

const count = Number(process.env.COUNT ?? 30);
const emailDomain = process.env.EMAIL_DOMAIN ?? "example.com";
const tokenTtl = Number(process.env.TOKEN_TTL_SECS ?? 3600);
const delayMs = Number(process.env.DELAY_MS ?? 100);
const outPath = resolve(process.env.OUT ?? "loadtest/tokens.json");

const clerk = createClerkClient({ secretKey });
const stamp = Date.now();
const entries = [];

for (let i = 1; i <= count; i++) {
  // "+clerk_test" subaddress marks the email as a test credential (no real delivery).
  const email = `loadtest+${stamp}+${i}+clerk_test@${emailDomain}`;

  const user = await clerk.users.createUser({
    emailAddress: [email],
    firstName: "LoadTest",
    lastName: `User${i}`,
    skipLegalChecks: true,
  });

  // Testing-only: creates an active session for the user without a sign-in flow.
  const session = await clerk.sessions.createSession({ userId: user.id });

  // `template` omitted => default session token (same kind the frontend sends as `__session`).
  const { jwt } = await clerk.sessions.getToken(session.id, undefined, tokenTtl);

  entries.push({ email, userId: user.id, sessionId: session.id, token: jwt });
  process.stdout.write(`\rGenerated ${i}/${count}`);

  if (i < count) {
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");

console.log(`\n\nWrote ${entries.length} tokens to ${outPath}`);
