/**
 * Simple Supabase-based job queue — replaces Inngest for background job processing.
 *
 * Usage:
 *   import { enqueueJob } from "@/lib/queue";
 *   await enqueueJob("thesis", { userId, data: { ... } });
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

async function getQueueClient() {
  const url = runtimeEnv("SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env vars for queue");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Add a job to the generation queue.
 */
export async function enqueueJob(
  jobType: "thesis" | "proposal" | "assignment" | "seminar",
  payload: Record<string, unknown>,
): Promise<string> {
  const supabase = await getQueueClient();
  const { data, error } = await (supabase as any)
    .from("generation_queue")
    .insert({
      job_type: jobType,
      payload,
      status: "pending",
      attempts: 0,
      max_attempts: 3,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to enqueue job: ${error.message}`);
  return (data as any).id;
}

/**
 * Claim the next pending job (atomically — uses row-level locking via Supabase).
 * Called by the worker. Returns null if no pending jobs.
 */
export async function claimNextJob(): Promise<{
  id: string;
  job_type: "thesis" | "proposal" | "assignment" | "seminar";
  payload: Record<string, unknown>;
} | null> {
  const supabase = await getQueueClient();

  // Find the oldest pending job
  const { data: pending } = await (supabase as any)
    .from("generation_queue")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1);

  if (!pending || pending.length === 0) return null;
  const jobId = pending[0].id;

  // Atomically claim it — only update if still pending
  const { data: claimed } = await (supabase as any)
    .from("generation_queue")
    .update({
      status: "processing",
      locked_at: new Date().toISOString(),
      attempts: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId)
    .eq("status", "pending")
    .select();

  if (!claimed || claimed.length === 0) return null;
  const j = claimed[0];
  return {
    id: j.id,
    job_type: j.job_type,
    payload: j.payload,
  };
}

/**
 * Mark a job as completed.
 */
export async function completeJob(jobId: string): Promise<void> {
  const supabase = await getQueueClient();
  const { error } = await (supabase as any)
    .from("generation_queue")
    .update({
      status: "completed",
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw new Error(`Failed to complete job: ${error.message}`);
}

/**
 * Mark a job as failed. If attempts < max_attempts, reset to pending for retry.
 */
export async function failJob(
  jobId: string,
  errorMsg: string,
  attempts: number,
  maxAttempts: number,
): Promise<void> {
  const supabase = await getQueueClient();
  const willRetry = attempts < maxAttempts;

  await (supabase as any)
    .from("generation_queue")
    .update({
      status: willRetry ? "pending" : "failed",
      error: errorMsg,
      attempts: attempts + 1,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
