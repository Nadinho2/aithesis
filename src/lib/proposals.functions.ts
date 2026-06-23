import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { fetchScholarlyRefs, formatAPA, type ScholarlyRef } from "./scholarly.server";
import { buildProposalDocx, toBase64 } from "./docx.server";
import { scrubObject, countWordsDeep, trimToExactWords, callAI } from "./ai-utils.server";
import { checkGenerateLimit, incrementUsage } from "./admin-limits.functions";

const ManualTopic = z.object({
  title: z.string().min(5).max(300),
  problem_statement: z.string().min(20).max(4000),
  research_gap: z.string().min(10).max(2000),
  objectives: z.array(z.string().min(2).max(400)).min(1).max(10),
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

    // Payment check — if user has paid, skip limit check
    const { data: paidTx } = await (supabase as any)
      .from("transactions")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "completed")
      .eq("product", "proposal")
      .limit(1);
    const isPaid = paidTx?.length > 0;

    if (!isPaid) {
      const canGen = await checkGenerateLimit(supabase, userId, "proposal");
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

    const timelineRule = isUndergrad
      ? "DO NOT include a Timeline section. Return an empty string for the timeline field."
      : "Include a realistic Timeline section organised by months or quarters covering the full study.";

    const citationRules = data.citation_style === "harvard"
      ? `CITATION RULES (Harvard style):
- Only cite the references provided below. Never invent sources.
- Inline parenthetical format: (Author, Year); (Author and Author, Year); for 4+ authors use (First et al., Year) after first use.
- For narrative citations: Author (Year)...
- Synthesise at least 12 references across background and literature review — argue themes, compare findings, identify gaps.
- Reference list is rendered separately — do NOT output a bibliography.`
      : `CITATION RULES (APA 7th):
- Only cite the references provided below. Never invent sources.
- Inline format: (Author, Year); (Author & Author, Year); (First et al., Year) for 3+.
- For narrative citations: Author (Year)...
- Synthesise at least 12 references across background and literature review — argue themes, compare findings, identify gaps.
- Reference list is rendered separately — do NOT output a bibliography.`;

    const baseSystemRules = `You are a senior academic writing a graduate-level research proposal in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} citation style. Write in clear, natural academic English with varied sentence structure.

RULES:
- Plain text only — NO markdown syntax (no *,**,#,>, -, backticks).
- Vary sentence length: mix short declarative sentences with longer analytical ones.
- Use specific, concrete details (numbers, methods, locations).
- Do not copy phrasing from the provided references — write originally.
- Each paragraph should be 3-6 sentences.
- Never invent citations — only cite the references provided below.

${citationRules}

Return ONLY valid JSON. No preamble, no commentary, no markdown.`;

    const topicContext = `RESEARCH TOPIC: ${topicCtx.title}
PROBLEM: ${topicCtx.problem_statement}
RESEARCH GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives.join("; ")}
DEPARTMENT: ${topicCtx.department ?? ""}
CONTEXT/COUNTRY: ${topicCtx.country ?? "Not specified"}
RESEARCH TYPE: ${topicCtx.research_type ?? "Not specified"}
ACADEMIC LEVEL: ${data.level}

VERIFIED SCHOLARLY REFERENCES (cite these only):
${refContext}`;

    // Parallel chunked generation — split into 3 logical groups + abstract.
    const abstractTarget = Math.max(80, Math.round(target * 0.03));
    const prelimTarget = Math.round(target * 0.28);
    const litReviewTarget = Math.round(target * 0.44);
    const methodTarget = Math.round(target * 0.25);

    const genAbstractChunk = async () => {
      const system = `${baseSystemRules}
Write ONLY the abstract field. Return JSON: {"abstract": "..."}
Target: EXACTLY ${abstractTarget} words. Single continuous paragraph.`;
      const raw = await callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: topicContext });
      return raw?.abstract ?? "";
    };

    const genPreliminaryChunk = async () => {
      const system = `${baseSystemRules}
Write ONLY these fields as JSON:
{"background_to_the_study":"...","statement_of_the_problem":"...","objectives":["Obj1","Obj2","Obj3"],"research_questions":["RQ1","RQ2"],"research_hypotheses":["H1","H2"],"significance":"...","scope_of_the_study":"...","definition_of_terms":"..."}
Target total for these 8 fields: EXACTLY ${prelimTarget} words. Background and statement of problem longest.`;
      return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: topicContext });
    };

    const genLitReviewChunk = async () => {
      const system = `${baseSystemRules}
Write ONLY the literature review fields as JSON:
{"conceptual_review":"...","empirical_review":"...","theoretical_review":"...","theoretical_framework":"...","summary_of_reviews":"...","gap_in_literature":"..."}
Target total: EXACTLY ${litReviewTarget} words. Synthesise at least 8 references.`;
      return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: topicContext });
    };

    const genMethodologyChunk = async () => {
      const system = `${baseSystemRules}
Write ONLY the methodology fields as JSON:
{"research_design":"...","area_of_the_study":"...","population_of_the_study":"...","sample_size":"...","sampling_technique":"...","instrumentation":"...","validity_of_instrument":"...","reliability_of_instrument":"...","method_of_collecting_data":"...","method_of_data_analysis":"..."}
Target total: EXACTLY ${methodTarget} words.`;
      return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: topicContext });
    };

    let abstract: string;
    let prelimData: any;
    let litData: any;
    let methodData: any;

    try {
      const results = await Promise.all([
        genAbstractChunk(),
        genPreliminaryChunk(),
        genLitReviewChunk(),
        genMethodologyChunk(),
      ]);
      abstract = results[0];
      prelimData = results[1];
      litData = results[2];
      methodData = results[3];
    } catch (e) {
      console.error("Proposal parallel generation failed:", e instanceof Error ? e.message : String(e));
      throw new Error("Proposal generation failed. Please try again.");
    }

    // Assemble full proposal from chunks
    let parsed: any = {
      abstract,
      sections: { ...prelimData, ...litData, ...methodData },
    };

    const fullSections = SectionSchema.parse(parsed.sections);
    parsed = ProposalSchema.parse({ abstract: parsed.abstract, sections: fullSections });

    let total = countWordsDeep(parsed);
    let attempts = 0;
    while (total < target && attempts < 5) {
      attempts++;
      const diff = target - total;
      try {
        const refine = await callAI(apiKey, {
          model: "deepseek-reasoner",
          max_tokens: 64000,
          system: baseSystemRules,
          user: `Your previous draft was ${total} words. Target: EXACTLY ${target} words (SHORT by ${diff}).
Expand conceptual_review, empirical_review, theoretical_review, and background_to_the_study. Return COMPLETE updated JSON.

PREVIOUS DRAFT:
${JSON.stringify(parsed)}`,
        });
        const refined = ProposalSchema.parse(refine);
        const scrubbed = scrubObject(refined) as typeof parsed;
        const newTotal = countWordsDeep(scrubbed);
        if (newTotal > total) { parsed = scrubbed; total = newTotal; }
        else break;
      } catch (e) {
        console.error("Proposal refinement failed:", e);
        break;
      }
    }

    if (total > target) {
      parsed = trimProposalToExact(parsed, target);
      total = countWordsDeep(parsed);
    }

    const referencesList = refs.map((r) => ({ ...r, apa: formatAPA(r) }));

    const { data: created, error: insErr } = await supabase
      .from("proposals")
      .insert({
        user_id: userId,
        topic_id: topicCtx.id,
        title: topicCtx.title,
        level: data.level,
        department: topicCtx.department ?? null,
        area_of_interest: topicCtx.area_of_interest ?? null,
        country: topicCtx.country ?? null,
        research_type: topicCtx.research_type ?? null,
        abstract: parsed.abstract,
        sections: parsed.sections,
        references_list: referencesList,
        word_count: total,
        citation_style: data.citation_style,
        status: "draft",
      } as any)
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    // Increment usage after successful generation
    await incrementUsage(supabase, userId, "proposal");

    return { proposal: created };
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
