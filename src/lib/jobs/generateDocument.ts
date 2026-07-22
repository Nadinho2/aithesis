/**
 * Document generation wrapper with completeness checks and retry logic.
 *
 * Wraps generateChapters() from pipeline.ts with:
 *   - Pre-humanization completeness validation
 *   - Automatic single retry for incomplete chapters
 *   - Failure notification (email + status update) if retry also fails
 */
import type { GeneratedChapter, PipelinePayload } from "./pipeline";
import { generateChapters } from "./pipeline";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ─── Types ─────────────────────────────────────────────────────────────────

interface CompletenessResult {
  passed: boolean;
  reason?: string;
}

interface GenerationResult {
  success: boolean;
  chapters?: GeneratedChapter[];
  error?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

async function getSupabase() {
  const url = runtimeEnv("SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Completeness Check ────────────────────────────────────────────────────

/**
 * Validate generated chapters meet minimum quality thresholds.
 *
 * Checks:
 *   1. All chapters have content (at least 100 chars)
 *   2. Total word count meets 70% of the expected minimum
 *   3. No chapter ends mid-sentence (must end with . ! or ?)
 */
function checkCompleteness(
  chapters: GeneratedChapter[],
  expectedWordCount: number
): CompletenessResult {
  // Check 1: all chapters have content
  const emptyChapters = chapters.filter(
    (c) => !c.content || c.content.trim().length < 100
  );
  if (emptyChapters.length > 0) {
    return {
      passed: false,
      reason: `Empty or incomplete chapters: ${emptyChapters
        .map((c) => c.chapterTitle)
        .join(", ")}`,
    };
  }

  // Check 2: total word count meets minimum threshold
  const totalWords = chapters.reduce((sum, c) => {
    return sum + (c.content ? c.content.split(/\s+/).length : 0);
  }, 0);

  const minimumWords = Math.floor(expectedWordCount * 0.7);
  if (totalWords < minimumWords) {
    return {
      passed: false,
      reason: `Generated ${totalWords} words but expected minimum ${minimumWords} (70% of ${expectedWordCount})`,
    };
  }

  // Check 3: no chapter ends mid-sentence
  const truncatedChapters = chapters.filter((c) => {
    const trimmed = (c.content ?? "").trim();
    if (!trimmed) return false;
    const lastChar = trimmed[trimmed.length - 1];
    return !".!?".includes(lastChar);
  });
  if (truncatedChapters.length > 0) {
    return {
      passed: false,
      reason: `Truncated content detected in: ${truncatedChapters
        .map((c) => c.chapterTitle)
        .join(", ")}`,
    };
  }

  return { passed: true };
}

// ─── Generation with Retry ─────────────────────────────────────────────────

/**
 * Generate document chapters with a single retry on completeness failure.
 *
 * Flow:
 *   1. Call generateChapters()
 *   2. Run completeness check on the result
 *   3. If it fails, retry once (only failed chapters)
 *   4. If retry also fails, update DB status to 'failed' and send email
 *   5. If successful, return the chapters for humanization
 *
 * @param payload     The pipeline payload for generateChapters
 * @param apiKey      DeepSeek API key
 * @param userId      User ID for failure notification
 * @param taskId      Optional task ID for status updates in generation_tasks table
 * @param documentTable  Supabase table name for status updates (e.g. "assignments")
 * @param toolName    Tool name for failure email (e.g. "Assignment", "Thesis")
 * @param expectedWordCount  Target word count for completeness validation
 *
 * @returns           GenerationResult with chapters on success, error on failure
 */
export async function generateDocumentWithRetry(
  payload: PipelinePayload,
  apiKey: string,
  userId: string,
  taskId: string | undefined,
  documentTable: string,
  toolName: string,
  expectedWordCount: number
): Promise<GenerationResult> {
  // ── First attempt ──
  let chapters = await generateChapters(payload, apiKey);
  let result = checkCompleteness(chapters, expectedWordCount);

  if (!result.passed) {
    console.error(
      `[generateDocument] Completeness check failed (attempt 1): ${result.reason}`
    );

    // ── Retry ──
    await new Promise((r) => setTimeout(r, 2000));

    // Retry only the chapters that failed
    const failedKeys = new Set<string>();
    chapters.forEach((c) => {
      const content = (c.content ?? "").trim();
      if (
        content.length < 100 ||
        (content.length > 0 && !".!?".includes(content[content.length - 1]))
      ) {
        failedKeys.add(c.key);
      }
    });

    // Filter payload to only include failed chapters
    const retryPayload: PipelinePayload = {
      ...payload,
      activeChapters: payload.activeChapters.filter((ch) =>
        failedKeys.has(ch.key)
      ),
    };

    if (retryPayload.activeChapters.length > 0) {
      try {
        const retryChapters = await generateChapters(retryPayload, apiKey);

        // Merge retried chapters into the original result
        const retryMap = new Map(retryChapters.map((c) => [c.key, c]));
        chapters = chapters.map((c) =>
          retryMap.has(c.key) ? retryMap.get(c.key)! : c
        );
      } catch (e: any) {
        console.error(
          `[generateDocument] Retry generation failed: ${e?.message}`
        );
        // Don't throw — fall through to second completeness check with original chapters
      }
    }

    // ── Second completeness check after retry ──
    result = checkCompleteness(chapters, expectedWordCount);

    if (!result.passed) {
      console.error(
        `[generateDocument] Completeness check failed after retry: ${result.reason}`
      );

      // Update task status to failed
      if (taskId) {
        try {
          const supabase = await getSupabase();
          await (supabase as any)
            .from("generation_tasks")
            .update({ status: "failed", updated_at: new Date().toISOString() })
            .eq("id", taskId);
        } catch (e: any) {
          console.error(
            `[generateDocument] Failed to update task status: ${e?.message}`
          );
        }
      }

      // Update document status to failed
      try {
        const supabase = await getSupabase();
        await (supabase as any)
          .from(documentTable)
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);
      } catch (e: any) {
        console.error(
          `[generateDocument] Failed to update document status: ${e?.message}`
        );
      }

      // Send failure email
      try {
        const { notifyToolFailed } = await import("@/lib/mail-helper");
        await notifyToolFailed(userId, toolName);
      } catch (e: any) {
        console.error(
          `[generateDocument] Failed to send failure email: ${e?.message}`
        );
      }

      return { success: false, error: result.reason };
    }
  }

  return { success: true, chapters };
}

export { checkCompleteness };
