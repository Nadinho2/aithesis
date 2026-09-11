import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type CertificateKind = "subject_mastery" | "path_completion";

export interface Certificate {
  id: string;
  recipient_name: string | null;
  kind: CertificateKind;
  title: string;
  subtitle: string | null;
  criteria: Record<string, unknown>;
  ai_note: string | null;
  issued_at: string;
}

// Eligibility thresholds (fixed, measurable — not AI-decided).
const SUBJECT_MIN_ATTEMPTS = 20;
const SUBJECT_MIN_ACCURACY = 0.7; // 70%

function normalizeCertificate(row: any): Certificate {
  return {
    id: row.id,
    recipient_name: row.recipient_name ?? null,
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle ?? null,
    criteria: row.criteria ?? {},
    ai_note: row.ai_note ?? null,
    issued_at: row.issued_at,
  };
}

// ─── Check eligibility, issue any new certificates, return all ─────────────
// Idempotent: a certificate is only issued once per (kind, title).
export const getMyCertificates = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const { data: existing } = await supabase
      .from("certificates")
      .select("kind, title")
      .eq("user_id", userId);
    const existingKeys = new Set(
      ((existing ?? []) as Array<{ kind: string; title: string }>).map((c) => `${c.kind}:${c.title}`),
    );

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle();
    const recipientName = profile?.full_name ?? null;

    const toIssue: Array<{
      kind: CertificateKind;
      title: string;
      subtitle: string;
      criteria: Record<string, unknown>;
      ai_note: string;
    }> = [];

    // 1. Subject mastery — past questions practice performance.
    const { data: signals } = await supabase
      .from("learning_signals")
      .select("subject, attempts, correct")
      .eq("user_id", userId);

    for (const s of (signals ?? []) as Array<{ subject: string; attempts: number; correct: number }>) {
      const accuracy = s.correct / s.attempts;
      if (s.attempts >= SUBJECT_MIN_ATTEMPTS && accuracy >= SUBJECT_MIN_ACCURACY) {
        const title = `Past Questions Master — ${s.subject}`;
        if (!existingKeys.has(`subject_mastery:${title}`)) {
          toIssue.push({
            kind: "subject_mastery",
            title,
            subtitle: `Demonstrated consistent mastery of ${s.subject} practice questions.`,
            criteria: {
              subject: s.subject,
              attempts: s.attempts,
              correct: s.correct,
              accuracy: Number(accuracy.toFixed(3)),
            },
            ai_note: `Scored ${Math.round(accuracy * 100)}% across ${s.attempts} ${s.subject} practice questions.`,
          });
        }
      }
    }

    // 2. Path completion — every step's lesson passed.
    const { data: paths } = await supabase
      .from("learning_paths")
      .select("id, title")
      .eq("status", "published");
    const { data: steps } = await supabase
      .from("learning_path_steps")
      .select("path_id, course_id");
    const { data: completions } = await supabase
      .from("micro_course_completions")
      .select("course_id")
      .eq("user_id", userId)
      .eq("passed", true);

    const completedIds = new Set(((completions ?? []) as Array<{ course_id: string }>).map((c) => c.course_id));

    for (const p of (paths ?? []) as Array<{ id: string; title: string }>) {
      const pathSteps = ((steps ?? []) as Array<{ path_id: string; course_id: string }>).filter(
        (s) => s.path_id === p.id,
      );
      if (pathSteps.length === 0) continue;
      if (pathSteps.every((s) => completedIds.has(s.course_id))) {
        const title = `Completed: ${p.title}`;
        if (!existingKeys.has(`path_completion:${title}`)) {
          toIssue.push({
            kind: "path_completion",
            title,
            subtitle: `Completed every lesson in the ${p.title} learning path.`,
            criteria: { path_id: p.id, steps: pathSteps.length },
            ai_note: `Completed all ${pathSteps.length} lessons in the ${p.title} learning path.`,
          });
        }
      }
    }

    // Issue new certificates.
    for (const cert of toIssue) {
      await supabase.from("certificates").insert({
        user_id: userId,
        recipient_name: recipientName,
        ...cert,
      });
    }

    const { data: all } = await supabase
      .from("certificates")
      .select("*")
      .eq("user_id", userId)
      .order("issued_at", { ascending: false });

    return {
      newly_issued: toIssue.length,
      certificates: ((all ?? []) as any[]).map(normalizeCertificate),
    };
  });

// ─── Public getter for the shareable certificate page (no auth) ────────────
export const getCertificate = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { data: row, error } = await supabaseAdmin
      .from("certificates")
      .select("id, recipient_name, kind, title, subtitle, criteria, ai_note, issued_at")
      .eq("id", data.id)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!row) throw new Error("Certificate not found.");

    return normalizeCertificate(row);
  });
