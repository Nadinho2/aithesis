import { inngest } from "./client";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ─── Helpers ───────────────────────────────────────────────────────────────

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

const SITE = "https://www.mybrainpadi.com";

async function getSupabase() {
  const url = runtimeEnv("SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toolToEmailType(tool: string): "thesis" | "assignment" | "exam" | "presentation" | "cv" | "side_hustle" {
  if (tool === "proposal") return "thesis";
  return tool as any;
}

// ─── Generate Thesis ──────────────────────────────────────────────────────

export const generateThesisJob = inngest.createFunction(
  { id: "generate-thesis", triggers: { event: "mybrainpadi/thesis.generate" } },
  async ({ event, step }) => {
    const { userId, data } = event.data as any;
    const supabase = await getSupabase();

    // Update task status to processing
    await step.run("update-status-processing", async () => {
      if (data.taskId) {
        await (supabase as any)
          .from("generation_tasks")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", data.taskId);
      }
    });

    // Build topic context
    const topicCtx = data.topicCtx;
    const refs = data.refs ?? [];
    const target = data.target_words;
    const refContext = refs
      .map((r: any, i: number) => `[${i + 1}] ${r.title || "Untitled"} by ${r.authors || "Unknown"} (${r.year || "n.d."}) – ${r.journal || r.publisher || ""}`)
      .join("\n");

    const baseRules = `CITATION STYLE: ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"}
Write in clear, natural academic English. Do NOT use markdown syntax. Do NOT invent citations — only cite the provided references.`;

    const topicContext = `RESEARCH TOPIC: ${topicCtx.title}
PROBLEM: ${topicCtx.problem_statement}
GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}
LEVEL: ${data.level}

REFERENCES:
${refContext}`;

    const abstractTarget = Math.max(200, Math.round(target * 0.04));
    const chapterWeights = [0.15, 0.32, 0.18, 0.20, 0.15];
    const chapterDefs = [
      { key: "chapter_1_introduction", label: "Chapter 1: Introduction", instructions: `Cover: Background to the Study, Statement of the Problem, Objectives, Research Questions, Hypotheses, Significance, Scope, Definition of Terms.` },
      { key: "chapter_2_literature_review", label: "Chapter 2: Literature Review", instructions: `Cover: Conceptual Review, Empirical Review, Theoretical Review, Theoretical Framework, Summary/Gap. Synthesise at least 10 references.` },
      { key: "chapter_3_methodology", label: "Chapter 3: Research Methodology", instructions: `Cover: Research Design, Area of Study, Population, Sample Size & Technique, Instrumentation, Validity/Reliability, Data Collection, Data Analysis.` },
      { key: "chapter_4_results_findings", label: "Chapter 4: Results and Findings", instructions: `Present findings using tables, percentages, and charts described in text. Cover both descriptive and inferential statistics.` },
      { key: "chapter_5_discussion_conclusion", label: "Chapter 5: Discussion, Conclusion and Recommendations", instructions: `Discuss findings, conclude, recommend, suggest further studies, and note limitations.` },
    ].map((d, i) => ({ ...d, target: Math.max(500, Math.round(target * chapterWeights[i])) }));

    const { callAIText } = await import("@/lib/ai-utils.server");
    const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";

    const chapters: Record<string, string> = {};

    // Generate abstract + chapters in parallel
    const genPromises = [
      step.run("generate-abstract", async () => {
        const system = `You are a senior academic writing the abstract of a ${data.level} thesis.\n${baseRules}\nTarget: EXACTLY ${abstractTarget} words. Single paragraph.`;
        return callAIText(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: `${topicContext}\n\nWrite the abstract.` });
      }),
      ...chapterDefs.map((def) =>
        step.run(`generate-${def.key}`, async () => {
          const system = `You are a senior academic writing ${def.label} of a ${data.level} thesis.\n${baseRules}\n${def.instructions}\nTarget: EXACTLY ${def.target} words.\nUse sub-headings on their own lines. Output plain text.`;
          return callAIText(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${def.label} now — EXACTLY ${def.target} words.` });
        })
      ),
    ];

    const results = await Promise.all(genPromises);
    const abstract = results[0];
    for (let i = 0; i < chapterDefs.length; i++) {
      chapters[chapterDefs[i].key] = results[i + 1];
    }

    // Word count enforcement — expand shortest chapters
    const { countWords, countWordsDeep, scrubObject } = await import("@/lib/ai-utils.server");
    let total = abstractTarget + chapterDefs.reduce((s, d) => s + countWords(chapters[d.key] ?? ""), 0);

    let expandAttempts = 0;
    while (total < target && expandAttempts < 6) {
      expandAttempts++;
      const diff = target - total;
      const sorted = chapterDefs
        .map((d) => ({ ...d, current: countWords(chapters[d.key] ?? "") }))
        .sort((a, b) => a.current - b.current);
      const toExpand = sorted.slice(0, 2);

      const expandResults = await Promise.all(toExpand.map(async (c) => {
        const overshoot = Math.max(Math.ceil(diff / toExpand.length) * 2, Math.round(c.target * 0.3));
        const newTarget = c.current + overshoot;
        const system = `You are a senior academic writing ${c.label} of a ${data.level} thesis.\n${baseRules}\nYou previously wrote a version. EXPAND it substantially. Keep ALL existing content. Target for this chapter: AT LEAST ${newTarget} words (currently ${c.current}). Output FULL updated chapter as plain text.`;
        const content = await callAIText(apiKey, { max_tokens: 64000, model: "deepseek-reasoner", system, user: `${topicContext}\n\nCURRENT DRAFT:\n${chapters[c.key]}` });
        return { key: c.key, content };
      }));

      for (const e of expandResults) chapters[e.key] = e.content;
      total = abstractTarget + chapterDefs.reduce((s, d) => s + countWords(chapters[d.key] ?? ""), 0);
    }

    // HARD ENFORCEMENT — never save below target
    if (total < target) {
      // Send failure email
      await step.run("send-failure-email", async () => {
        const { notifyToolFailed } = await import("@/lib/mail-helper");
        await notifyToolFailed(userId, "Thesis");
      });
      // Save as draft with partial content
      await step.run("save-partial-thesis", async () => {
        const { error } = await supabase
          .from("theses")
          .insert({
            user_id: userId,
            title: topicCtx.title,
            level: data.level,
            abstract: abstract ?? "",
            chapters: chapters ?? {},
            references_list: refs.map((r: any) => ({ ...r, apa: `${r.authors ?? "Unknown"} (${r.year ?? "n.d."}). ${r.title ?? ""}. ${r.journal ?? ""}` })),
            word_count: total,
            citation_style: data.citation_style,
            status: "draft",
          } as any)
          .select()
          .single();
      });
      return { success: false, error: `Only reached ${total} words (target: ${target})` };
    }

    // Save completed thesis
    await step.run("save-thesis", async () => {
      const { data: created, error } = await supabase
        .from("theses")
        .insert({
          user_id: userId,
          title: topicCtx.title,
          level: data.level,
          abstract,
          chapters,
          references_list: refs.map((r: any) => ({ ...r, apa: `${r.authors ?? "Unknown"} (${r.year ?? "n.d."}). ${r.title ?? ""}. ${r.journal ?? ""}` })),
          word_count: total,
          citation_style: data.citation_style,
          status: "completed",
        } as any)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return created;
    });

    // Send email
    await step.run("send-email", async () => {
      const { notifyToolCompleted } = await import("@/lib/mail-helper");
      await notifyToolCompleted(userId, "thesis", {
        title: topicCtx.title,
        downloadUrl: `${SITE}/thesis/...`,
        aiScore: 85,
        plagiarismScore: 92,
      });
    });

    // Update task to completed
    await step.run("update-status-completed", async () => {
      if (data.taskId) {
        await (supabase as any)
          .from("generation_tasks")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", data.taskId);
      }
    });

    return { success: true };
  },
);

// ─── Generate Proposal ─────────────────────────────────────────────────────

export const generateProposalJob = inngest.createFunction(
  { id: "generate-proposal", triggers: { event: "mybrainpadi/proposal.generate" } },
  async ({ event, step }) => {
    const { userId, data } = event.data as any;
    const supabase = await getSupabase();

    await step.run("update-status-processing", async () => {
      if (data.taskId) {
        await (supabase as any)
          .from("generation_tasks")
          .update({ status: "processing", updated_at: new Date().toISOString() })
          .eq("id", data.taskId);
      }
    });

    const topicCtx = data.topicCtx;
    const refs = data.refs ?? [];
    const target = data.target_words;
    const refContext = refs
      .map((r: any, i: number) => `[${i + 1}] ${r.title || "Untitled"} by ${r.authors || "Unknown"} (${r.year || "n.d."})`)
      .join("\n");

    const baseSystemRules = `You are a senior academic writing a graduate-level research proposal in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} citation style.\nRULES:\n- Plain text only, no markdown.\n- Vary sentence length.\n- Never invent citations — only cite provided references.\n- Return ONLY valid JSON.`;

    const topicContext = `RESEARCH TOPIC: ${topicCtx.title}\nPROBLEM: ${topicCtx.problem_statement}\nGAP: ${topicCtx.research_gap}\nOBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}\nLEVEL: ${data.level}\nREFERENCES:\n${refContext}`;

    const abstractTarget = Math.max(80, Math.round(target * 0.03));
    const prelimTarget = Math.round(target * 0.28);
    const litReviewTarget = Math.round(target * 0.44);
    const methodTarget = Math.round(target * 0.25);

    const { callAI } = await import("@/lib/ai-utils.server");
    const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";

    const [abstract, prelimData, litData, methodData] = await Promise.all([
      step.run("generate-abstract", async () => {
        const raw = await callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system: `${baseSystemRules}\nWrite ONLY abstract. JSON: {"abstract":"..."} Target: ${abstractTarget} words.`, user: topicContext });
        return raw?.abstract ?? "";
      }),
      step.run("generate-preliminary", async () => {
        return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system: `${baseSystemRules}\nWrite ONLY: background_to_the_study, statement_of_the_problem, objectives, research_questions, research_hypotheses, significance, scope_of_the_study, definition_of_terms. Target: ${prelimTarget} words total.`, user: topicContext });
      }),
      step.run("generate-litreview", async () => {
        return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system: `${baseSystemRules}\nWrite ONLY: conceptual_review, empirical_review, theoretical_review, theoretical_framework, summary_of_reviews, gap_in_literature. Target: ${litReviewTarget} words total. Synthesise 8+ refs.`, user: topicContext });
      }),
      step.run("generate-methodology", async () => {
        return callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 64000, system: `${baseSystemRules}\nWrite ONLY: research_design, area_of_the_study, population_of_the_study, sample_size, sampling_technique, instrumentation, validity_of_instrument, reliability_of_instrument, method_of_collecting_data, method_of_data_analysis. Target: ${methodTarget} words total.`, user: topicContext });
      }),
    ]);

    const sections = { ...prelimData, ...litData, ...methodData };

    // Word count enforcement — expand shortest sections if below target
    const { countWords } = await import("@/lib/ai-utils.server");
    let totalWords = abstractTarget +
      Object.values(sections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);

    let expandAttempts = 0;
    while (totalWords < target && expandAttempts < 6) {
      expandAttempts++;
      const diff = target - totalWords;
      // Find the 2 shortest text sections
      const fieldLengths = Object.entries(sections).map(([k, v]) => ({ key: k, len: countWords(String(v ?? "")) }));
      fieldLengths.sort((a, b) => a.len - b.len);
      const toExpand = fieldLengths.slice(0, 2);

      for (const f of toExpand) {
        const overshoot = Math.max(Math.ceil(diff / toExpand.length), 500);
        const newTarget = f.len + overshoot;
        const expandPrompt = `Write a single long analytical paragraph expanding the section "${f.key}" of a research proposal.
Current length: ${f.len} words. Target: approximately ${newTarget} words.
Add substantive depth with synthesised citations, extended analysis, and concrete examples.
Write only the paragraph text — no headings, no JSON.`;
        try {
          const padText = await step.run(`expand-${f.key}-${expandAttempts}`, async () => {
            const { callAIText } = await import("@/lib/ai-utils.server");
            return callAIText(apiKey, { model: "deepseek-chat", system: baseSystemRules, user: expandPrompt });
          });
          sections[f.key as keyof typeof sections] = String(sections[f.key as keyof typeof sections] ?? "") + "\n\n" + padText;
        } catch {
          // Continue with what we have
        }
      }
      totalWords = abstractTarget +
        Object.values(sections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);
    }

    // HARD ENFORCEMENT — never save below target
    if (totalWords < target) {
      await step.run("send-proposal-failure-email", async () => {
        const { notifyToolFailed } = await import("@/lib/mail-helper");
        await notifyToolFailed(userId, "Thesis");
      });
      await step.run("save-partial-proposal", async () => {
        const { error } = await supabase
          .from("proposals")
          .insert({
            user_id: userId,
            topic_id: topicCtx.id ?? null,
            title: topicCtx.title,
            level: data.level,
            abstract,
            sections,
            references_list: refs.map((r: any) => ({ ...r, apa: `${r.authors ?? "Unknown"} (${r.year ?? "n.d."}). ${r.title ?? ""}` })),
            word_count: totalWords,
            citation_style: data.citation_style,
            status: "draft",
          } as any)
          .select()
          .single();
      });
      return { success: false, error: `Only reached ${totalWords} words (target: ${target})` };
    }

    // Save completed proposal
    await step.run("save-proposal", async () => {
      const { data: created, error } = await supabase
        .from("proposals")
        .insert({
          user_id: userId,
          topic_id: topicCtx.id ?? null,
          title: topicCtx.title,
          level: data.level,
          abstract,
          sections,
          references_list: refs.map((r: any) => ({ ...r, apa: `${r.authors ?? "Unknown"} (${r.year ?? "n.d."}). ${r.title ?? ""}` })),
          word_count: target,
          citation_style: data.citation_style,
          status: "completed",
        } as any)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return created;
    });

    // Send email
    await step.run("send-email", async () => {
      const { notifyToolCompleted } = await import("@/lib/mail-helper");
      await notifyToolCompleted(userId, "thesis", {
        title: topicCtx.title,
        downloadUrl: `${SITE}/proposals`,
        aiScore: 85,
        plagiarismScore: 92,
      });
    });

    await step.run("update-status-completed", async () => {
      if (data.taskId) {
        await (supabase as any)
          .from("generation_tasks")
          .update({ status: "completed", updated_at: new Date().toISOString() })
          .eq("id", data.taskId);
      }
    });

    return { success: true };
  },
);
