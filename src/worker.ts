/**
 * Background queue worker — polls `generation_queue` and processes jobs.
 *
 * Run standalone:  npx tsx src/worker.ts
 *
 * NOTE: Designed for single-pass execution. Processes all pending jobs
 * then exits. Suitable for GitHub Actions, cron, or one-shot invocations.
 *
 * For long-running mode, use: while true; do npx tsx src/worker.ts; sleep 2; done
 */
import { claimNextJob, completeJob, failJob } from "./lib/queue";
import { generateThesisContent, generateProposalContent, generateAssignmentContent, generateSeminarContent } from "./lib/generation.server";

const MAX_POLLS = 5;   // Poll up to 5 times for new jobs
const POLL_DELAY_MS = 2000; // Wait 2s between polls

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
    } else if (job.job_type === "assignment") {
      result = await generateAssignmentContent(job.payload as any);
    } else if (job.job_type === "seminar") {
      result = await generateSeminarContent(job.payload as any);
    } else {
      throw new Error(`Unknown job type: ${job.job_type}`);
    }

    if (result.success) {
      await completeJob(job.id);
      console.log(`[worker] Job ${job.id} completed successfully`);
    } else {
      await completeJob(job.id);
      console.warn(`[worker] Job ${job.id} completed with issues: ${result.error}`);
    }
  } catch (err: any) {
    const errMsg = err?.message ?? String(err);
    console.error(`[worker] Job ${job.id} failed:`, errMsg);

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
  console.log(`[worker] Queue worker started`);

  let processed = 0;
  for (let i = 0; i < MAX_POLLS; i++) {
    const didWork = await processJob();
    if (didWork) {
      processed++;
      // If we processed a job, reset poll counter — there might be more
      i = 0;
    } else {
      if (processed === 0 && i < MAX_POLLS - 1) {
        // No jobs yet — wait before next poll
        await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
      }
    }
  }

  console.log(`[worker] Done. Processed ${processed} job(s).`);
}

main().catch((err) => {
  console.error("[worker] Fatal error:", err);
  process.exit(1);
});
