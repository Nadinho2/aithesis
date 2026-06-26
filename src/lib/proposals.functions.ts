import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA, type ScholarlyRef } from "./scholarly.server";
import { buildProposalDocx, toBase64 } from "./docx.server";
import { scrubObject, countWordsDeep, trimToExactWords } from "./ai-utils.server";
import { checkGenerateLimit, incrementUsage } from "./admin-limits.functions";
import { enqueueJob } from "./queue";
import { getUserEmail } from "./mail-helper";

// Debug flag — log errors on stderr
const debug = (...args: any[]) => console.error("[proposals.fn]", ...args);

const ManualTopic = z.object({
  title: z.string().min(5).max(300),
  problem_statement: z.string().max(4000).optional().default(""),
  research_gap: z.string().max(2000).optional().default(""),
  objectives: z.array(z.string().max(400)).max(10).optional().default([]),
  department: z.string().max(120).optional().default(""),
  area_of_interest: z.string().max(200).optional().default(""),
  country: z.string().max(80).optional().default(""),
  research_type: z.string().max(80).optional().default(""),
});

const GenerateInput = z
  .object({
    topic_id: z.string().uuid().optional(),
    manual: ManualTopic.optional(),
    level: z.enum(["undergraduate", "masters", "phd"]).default("undergraduate"),
    target_words: z.number().int().min(500).max(80000).default(2800),
    citation_style: z.enum(["apa_7", "harvard"]).default("apa_7"),
  })
  .refine((d) => d.topic_id || d.manual, { message: "topic_id or manual required" });

const SectionSchema = z.object({
  background_to_the_study: z.string(),
  statement_of_the_problem: z.string(),
  objectives: z.array(z.string()),
  research_questions: z.array(z.string()),
  research_hypotheses: z.array(z.string()),
  significance: z.string(),
  scope_of_the_study: z.string(),
  definition_of_terms: z.string(),
  conceptual_review: z.string(),
  empirical_review: z.string(),
  theoretical_review: z.string(),
  theoretical_framework: z.string(),
  summary_of_reviews: z.string(),
  gap_in_literature: z.string(),
  research_design: z.string(),
  area_of_the_study: z.string(),
  population_of_the_study: z.string(),
  sample_size: z.string(),
  sampling_technique: z.string(),
  instrumentation: z.string(),
  validity_of_instrument: z.string(),
  reliability_of_instrument: z.string(),
  method_of_collecting_data: z.string(),
  method_of_data_analysis: z.string(),
});

const ProposalSchema = z.object({
  abstract: z.string(),
  sections: SectionSchema,
});

export const generateProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    try {
      debug("Starting generateProposal for user", userId);

      // Payment/credit check — user must have credits in user_limits
      const { data: limits } = await (supabase as any)
        .from("user_limits")
        .select("proposal_limit, proposal_used")
        .eq("user_id", userId)
        .maybeSingle();
      const remaining = (limits?.proposal_limit ?? 0) - (limits?.proposal_used ?? 0);
      const isPaid = remaining > 0;
      debug("isPaid:", isPaid, "remaining:", remaining);

      if (!isPaid) {
        const canGen = await checkGenerateLimit(supabase, userId, "proposal");
        debug("checkGenerateLimit:", canGen);
        if (!canGen) throw new Error("Generation limit reached. Upgrade your plan to continue.");
      }

      let topicCtx: {
      title: string;
      problem_statement: string;
      research_gap: string;
      objectives: string[];
      department?: string | null;
      area_of_interest?: string | null;
      country?: string | null;
      research_type?: string | null;
      id?: string | null;
    };

    if (data.topic_id) {
      const { data: topic, error } = await supabase
        .from("topics")
        .select("*")
        .eq("id", data.topic_id)
        .maybeSingle();
      if (error || !topic) throw new Error("Topic not found");
      topicCtx = {
        title: topic.title,
        problem_statement: topic.problem_statement,
        research_gap: topic.research_gap,
        objectives: topic.objectives ?? [],
        department: topic.department,
        area_of_interest: topic.area_of_interest,
        country: topic.country,
        research_type: topic.research_type,
        id: topic.id,
      };
    } else {
      const m = data.manual!;
      topicCtx = {
        title: m.title,
        problem_statement: m.problem_statement,
        research_gap: m.research_gap,
        objectives: m.objectives,
        department: m.department || null,
        area_of_interest: m.area_of_interest || null,
        country: m.country || null,
        research_type: m.research_type || null,
        id: null,
      };
    }

    const isUndergrad = data.level === "undergraduate";
    const target = data.target_words;

    const query = `${topicCtx.title} ${topicCtx.area_of_interest ?? ""}`.trim();
    const refs = await fetchScholarlyRefs(query, 6);
    if (refs.length === 0) {
      throw new Error("No scholarly references could be retrieved. Please try again.");
    }

    const refContext = refs
      .slice(0, 20)
      .map(
        (r, i) =>
          `[${i + 1}] ${r.authors.slice(0, 3).join(", ")}${r.authors.length > 3 ? " et al." : ""} (${r.year ?? "n.d."}). "${r.title}". ${r.venue ?? r.source}. ${r.abstract ? "Abstract: " + r.abstract : ""}`,
      )
      .join("\n\n");

    // Send processing started email (fire-and-forget)
    const processingEmail = await getUserEmail(userId);
    if (processingEmail) {
      const { sendProcessingStartedEmail } = await import("./mail");
      sendProcessingStartedEmail({
        to: processingEmail,
        name: processingEmail.split("@")[0],
        tool: "Proposal",
      });
    }

    // Decrement credit BEFORE enqueue (works for both payment and admin credits)
    await incrementUsage(supabase, userId, "proposal");

    // Enqueue background job for queue worker
    await enqueueJob("proposal", {
      userId,
      data: {
        level: data.level,
        target_words: target,
        citation_style: data.citation_style,
        topicCtx,
        refs: refs.slice(0, 20),
        isPaid,
      },
    });

    // Trigger GitHub Actions worker (fire-and-forget)
    const ghPat = typeof process !== "undefined" ? process.env?.GH_PAT : undefined;
    if (ghPat) {
      fetch("https://api.github.com/repos/Nadinho2/aithesis/dispatches", {
        method: "POST",
        headers: { Authorization: `Bearer ${ghPat}`, "Content-Type": "application/json", Accept: "application/vnd.github.v3+json" },
        body: JSON.stringify({ event_type: "process-queue" }),
      }).catch(() => {});
    }

    return { success: true, message: "Your proposal is being generated. You'll receive an email when it's ready." };
  } catch (err: any) {
    debug("generateProposal error:", err?.message ?? err);
    throw err;
  }
  });

function trimProposalToExact(p: z.infer<typeof ProposalSchema>, target: number): z.infer<typeof ProposalSchema> {
  // Trim longest text sections first until total equals target.
  const cloned = JSON.parse(JSON.stringify(p)) as typeof p;
  let total = countWordsDeep(cloned);
  const trimOrder = [
    "conceptual_review",
    "empirical_review",
    "theoretical_review",
    "background_to_the_study",
    "statement_of_the_problem",
    "definition_of_terms",
    "research_design",
    "theoretical_framework",
    "significance",
    "scope_of_the_study",
  ];
  for (const key of trimOrder) {
    if (total <= target) break;
    const v = (cloned.sections as any)[key];
    if (typeof v !== "string" || !v) continue;
    const words = v.trim().split(/\s+/);
    const excess = total - target;
    if (words.length > excess + 20) {
      (cloned.sections as any)[key] = trimToExactWords(v, words.length - excess);
      total = countWordsDeep(cloned);
    }
  }
  // Final hard trim of abstract if still over.
  if (total > target && cloned.abstract) {
    const abs = cloned.abstract.trim().split(/\s+/);
    const excess = total - target;
    cloned.abstract = trimToExactWords(cloned.abstract, Math.max(40, abs.length - excess));
  }
  return cloned;
}

export const getProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Proposal not found");
    return row;
  });

export const listProposals = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("proposals")
      .select("id,title,level,word_count,created_at,topic_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const deleteProposal = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("proposals").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const exportProposalDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Proposal not found");
    const bytes = await buildProposalDocx({
      title: row.title,
      level: row.level,
      department: row.department,
      area_of_interest: row.area_of_interest,
      country: row.country,
      abstract: row.abstract,
      word_count: row.word_count,
      sections: row.sections as any,
      references_list: (row.references_list as any) ?? [],
      citation_style: ((row as any).citation_style as "apa_7" | "harvard") ?? "apa_7",
    });
    const filename = sanitizeFilename(`${row.title}-proposal.docx`);
    return { base64: toBase64(bytes), filename, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  });

export type ProposalReference = ScholarlyRef & { apa: string };

function sanitizeFilename(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, "_").slice(0, 120);
}
