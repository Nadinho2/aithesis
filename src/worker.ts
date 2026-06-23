/**
 * Background queue worker — polls `generation_queue` and processes jobs.
 *
 * Run standalone:  npx tsx src/worker.ts
 * Or with PM2:    pm2 start --interpreter npx --interpreter-args tsx src/worker.ts
 *
 * In production (serverless), consider using a Supabase Edge Function
 * or cron-based trigger instead.
 */
import { claimNextJob, completeJob, failJob } from "./lib/queue";
import { generateThesisContent, generateProposalContent } from "./lib/generation.server";

const POLL_INTERVAL_MS = 2000; // 2 seconds

async function processJob(): Promise<boolean> {
  const job = await claimNextJob();
  if (!job) return false;

  console.log(`[worker] Processing job ${job.id} (${job.job_type})`);

  try {
    let result: { success: boolean; error?: string };

    if (job.job_type === "thesis") {
      result = await generateThesisContent(job.payload as any);
    } else if (job.job_type === "proposal") {
      result = await generateProposalContent(job.payload as any);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    if (result.success) {
      await completeJob(job.id);
      console.log(`[worker] Job ${job.id} completed successfully`);
    } else {
      // Save was partial/failed — still mark as completed (content saved as draft)
      await completeJob(job.id);
      console.warn(`[worker] Job ${job.id} completed with issues: ${result.error}`);
    }
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    console.error(`[worker] Job ${job.id} failed:`, errMsg);

    // Get current attempts from the job row
    let attempts = 0;
    let maxAttempts = 3;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        process.env.SUPABASE_URL ?? "",
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
      );
      const { data } = await supabase
        .from("generation_queue")
        .select("attempts, max_attempts")
        .eq("id", job.id)
        .single();
      if (data) {
        attempts = (data as any).attempts ?? 0;
        maxAttempts = (data as any).max_attempts ?? 3;
      }
    } catch {
      // Fallback values
    }

    await failJob(job.id, errMsg, attempts, maxAttempts);
  }

  return true;
}

async function main() {
  console.log("[worker] Queue worker started. Polling every ${POLL_INTERVAL_MS}ms...");

  // Process loop
  while (true) {
    try {
      const processed = await processJob();
      if (!processed) {
        // No jobs — wait before polling again
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
      // If a job was processed, immediately poll for the next one
    } catch (err) {
      console.error("[worker] Unexpected error in worker loop:", err);
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
