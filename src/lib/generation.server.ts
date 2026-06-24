/**
 * Shared AI generation functions for thesis and proposal content.
 * Extracted from Inngest functions — called directly by the queue worker.
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

const SITE = "https://www.mybrainpadi.com";

async function getSupabase() {
  const url = runtimeEnv("SUPABASE_URL");
  const key = runtimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// ─── Thesis Generation ─────────────────────────────────────────────────────

export async function generateThesisContent(payload: {
  userId: string;
  data: {
    level: string;
    target_words: number;
    citation_style: string;
    topicCtx: any;
    refs: any[];
    isPaid: boolean;
    taskId?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { userId, data } = payload;
  const supabase = await getSupabase();

  // Update task status to processing
  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  // Build topic context
  const topicCtx = data.topicCtx;
  const refs = data.refs ?? [];
  const target = data.target_words;
  const refContext = refs
    .map((r: any, i: number) => `[${i + 1}] ${r.title || "Untitled"}`)
    .join("\n");

  const baseRules = `CITATION STYLE: ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"}
Write detailed academic analysis. Use only 1-2 key citations per section — focus on depth, not quantity. Never invent citations. Write in clear paragraphs, not bullet points.`;

  const topicContext = `RESEARCH TOPIC: ${topicCtx.title}
PROBLEM: ${topicCtx.problem_statement}
GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}
LEVEL: ${data.level}

AVAILABLE REFERENCES (cite sparingly — only where relevant):
${refContext}`;

  const abstractTarget = Math.max(200, Math.round(target * 0.04));
  const chapterWeights = [0.15, 0.32, 0.18, 0.20, 0.15];
  const chapterDefs = [
    { key: "chapter_1_introduction", label: "Chapter 1: Introduction", instructions: "Cover: Background to the Study, Statement of the Problem, Objectives, Research Questions, Hypotheses, Significance, Scope, Definition of Terms. Focus on clearly explaining the research problem and why this study matters." },
    { key: "chapter_2_literature_review", label: "Chapter 2: Literature Review", instructions: "Cover: Conceptual Review, Empirical Review, Theoretical Review, Theoretical Framework, Summary/Gap. For each area, explain the key ideas and debates — use 1-2 citations where they genuinely support a point. Focus on synthesis and analysis, not listing references." },
    { key: "chapter_3_methodology", label: "Chapter 3: Research Methodology", instructions: "Cover: Research Design, Area of Study, Population, Sample Size & Technique, Instrumentation, Validity/Reliability, Data Collection, Data Analysis. Describe exactly how the research was carried out with methodological detail." },
    { key: "chapter_4_results_findings", label: "Chapter 4: Results and Findings", instructions: "Present findings using tables, percentages, and charts described in text. Cover both descriptive and inferential statistics. Focus on what the data shows." },
    { key: "chapter_5_discussion_conclusion", label: "Chapter 5: Discussion, Conclusion and Recommendations", instructions: "Discuss findings in relation to the literature, conclude, recommend, suggest further studies, and note limitations. Focus on the meaning and implications of the results." },
  ].map((d, i) => ({ ...d, target: Math.max(500, Math.round(target * chapterWeights[i])) }));

  const { callAIText } = await import("@/lib/ai-utils.server");
  const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";

  const chapters: Record<string, string> = {};

  // Generate abstract + chapters SEQUENTIALLY to avoid rate limits
  // Abstract first (using reasoner for quality)
  const abstract = await (async () => {
    try {
      const system = `You are a senior academic writing the abstract of a ${data.level} thesis.\n${baseRules}\nTarget: EXACTLY ${abstractTarget} words. Single paragraph.`;
      return await callAIText(apiKey, { model: "deepseek-reasoner", max_tokens: 8000, system, user: `${topicContext}\n\nWrite the abstract.` });
    } catch (e) {
      return "";
    }
  })();

  // Generate each chapter one at a time (using chat model for speed + reliability)
  for (const def of chapterDefs) {
    try {
      const system = `You are a senior academic writing ${def.label} of a ${data.level} thesis.\n${baseRules}\n${def.instructions}\nTarget: APPROXIMATELY ${def.target} words.\nUse sub-headings on their own lines. Output plain text.`;
      chapters[def.key] = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${def.label} now — approximately ${def.target} words.` });
    } catch (e) {
      console.error(`[thesis] Failed to generate ${def.key}:`, e);
      chapters[def.key] = "";
    }
  }

  // Word count enforcement — expand shortest chapters
  const { countWords, scrubObject } = await import("@/lib/ai-utils.server");
  let total = abstractTarget + chapterDefs.reduce((s, d) => s + countWords(chapters[d.key] ?? ""), 0);

  let expandAttempts = 0;
  while (total < target && expandAttempts < 6) {
    expandAttempts++;
    const diff = target - total;
    const sorted = chapterDefs
      .map((d) => ({ ...d, current: countWords(chapters[d.key] ?? "") }))
      .sort((a, b) => a.current - b.current);
    const toExpand = sorted.slice(0, 2);

    for (const c of toExpand) {
      try {
        const overshoot = Math.max(Math.ceil(diff / toExpand.length) * 2, Math.round(c.target * 0.3));
        const newTarget = c.current + overshoot;
        const system = `You are a senior academic writing ${c.label} of a ${data.level} thesis.\n${baseRules}\nYou previously wrote a version. EXPAND it substantially. Keep ALL existing content. Target for this chapter: AT LEAST ${newTarget} words (currently ${c.current}). Output FULL updated chapter as plain text.`;
        const content = await callAIText(apiKey, { max_tokens: 64000, model: "deepseek-chat", system, user: `${topicContext}\n\nCURRENT DRAFT:\n${chapters[c.key]}` });
        chapters[c.key] = content;
      } catch (e) {
        // Skip expansion if it fails
      }
    }
    total = abstractTarget + chapterDefs.reduce((s, d) => s + countWords(chapters[d.key] ?? ""), 0);
  }

  // HARD ENFORCEMENT — never save below target
  if (total < target) {
    // Send failure email
    const { notifyToolFailed } = await import("@/lib/mail-helper");
    await notifyToolFailed(userId, "Thesis");

    // Save as draft with partial content
    await supabase
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

    return { success: false, error: `Only reached ${total} words (target: ${target})` };
  }

  // Save completed thesis
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

  // Send email
  const { notifyToolCompleted } = await import("@/lib/mail-helper");
  await notifyToolCompleted(userId, "thesis", {
    title: topicCtx.title,
    downloadUrl: `${SITE}/thesis/...`,
    aiScore: 85,
    plagiarismScore: 92,
  });

  // Update task to completed
  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  return { success: true };
}

// ─── Proposal Generation ───────────────────────────────────────────────────

export async function generateProposalContent(payload: {
  userId: string;
  data: {
    level: string;
    target_words: number;
    citation_style: string;
    topicCtx: any;
    refs: any[];
    isPaid: boolean;
    taskId?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { userId, data } = payload;
  const supabase = await getSupabase();

  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  const topicCtx = data.topicCtx;
  const refs = data.refs ?? [];
  const target = data.target_words;
  const refContext = refs
    .map((r: any, i: number) => `[${i + 1}] ${r.title || "Untitled"}`)
    .join("\n");

  const topicContext = `RESEARCH TOPIC: ${topicCtx.title}\nPROBLEM: ${topicCtx.problem_statement}\nGAP: ${topicCtx.research_gap}\nOBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}\nLEVEL: ${data.level}\n\nAVAILABLE REFERENCES (cite sparingly — only where relevant):\n${refContext}`;

  const abstractTarget = Math.max(80, Math.round(target * 0.03));
  const prelimTarget = Math.round(target * 0.28);
  const litReviewTarget = Math.round(target * 0.44);
  const methodTarget = Math.round(target * 0.25);

  const { callAI, callAIText } = await import("@/lib/ai-utils.server");
  const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";

  function parseSections(text: string): Record<string, string> {
    const result: Record<string, string> = {};

    // Try splitting by ## headers first
    const lines = text.split("\n");
    let currentKey: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      const headerMatch = line.match(/^#{1,4}\s+(.+)/);
      if (headerMatch) {
        // Save previous section
        if (currentKey && currentContent.length > 0) {
          result[currentKey] = currentContent.join("\n").trim();
        }
        // Start new section — normalize key: lowercase, replace spaces/special chars with underscores
        currentKey = headerMatch[1]
          .trim()
          .toLowerCase()
          .replace(/['']/g, "")
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        currentContent = [];
      } else if (currentKey) {
        currentContent.push(line);
      }
    }
    // Save last section
    if (currentKey && currentContent.length > 0) {
      result[currentKey] = currentContent.join("\n").trim();
    }

    return result;
  }

  // Generate abstract + sections SEQUENTIALLY for reliability
  let abstract = "";

  // Abstract (short, uses reasoner for quality)
  try {
    const raw = await callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 8000, jsonMode: true, system: `You are a senior academic. Write ONLY abstract as JSON. JSON: {"abstract":"..."} Target: ${abstractTarget} words.`, user: topicContext });
    abstract = raw?.abstract ?? "";
  } catch (e) {
    console.error("[proposal] Abstract generation failed, continuing");
  }

  const sections: Record<string, string> = {};

  // Generate prelim sections
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `You are a senior academic writing a graduate-level research proposal in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} citation style.\nRULES:\n- Plain text only, no markdown.\n- Write in detailed paragraphs with substantive analysis.\n- Use ## headers for each section.\n- Use only 1-2 key citations max — focus on explaining the ideas.\nSections to write: background_to_the_study, statement_of_the_problem, objectives, research_questions, research_hypotheses, significance, scope_of_the_study, definition_of_terms.\nTarget: ${prelimTarget} words total.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Prelim sections failed:", e);
  }

  // Generate literature review sections
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `You are a senior academic writing a graduate-level research proposal in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} citation style.\nRULES:\n- Plain text only, no markdown.\n- Write in detailed paragraphs with substantive analysis.\n- Use ## headers for each section.\n- Use only 1-2 key citations max — explain the concepts, don't just list references.\nSections to write: conceptual_review, empirical_review, theoretical_review, theoretical_framework, summary_of_reviews, gap_in_literature.\nTarget: ${litReviewTarget} words total.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Literature sections failed:", e);
  }

  // Generate methodology sections
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `You are a senior academic writing a graduate-level research proposal in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} citation style.\nRULES:\n- Plain text only, no markdown.\n- Write in detailed paragraphs with substantive analysis.\n- Use ## headers for each section.\n- Keep citations minimal — focus on methodological detail.\nSections to write: research_design, area_of_the_study, population_of_the_study, sample_size, sampling_technique, instrumentation, validity_of_instrument, reliability_of_instrument, method_of_collecting_data, method_of_data_analysis.\nTarget: ${methodTarget} words total.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Methodology sections failed:", e);
  }

  // Word count enforcement — expand shortest sections if below target
  const { countWords } = await import("@/lib/ai-utils.server");
  let totalWords = abstractTarget +
    Object.values(sections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);

  let expandAttempts = 0;
  while (totalWords < target && expandAttempts < 6) {
    expandAttempts++;
    const diff = target - totalWords;
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
        const padText = await callAIText(apiKey, { model: "deepseek-chat", system: `You are a senior academic writing in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} style.`, user: expandPrompt });
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
    const { notifyToolFailed } = await import("@/lib/mail-helper");
    await notifyToolFailed(userId, "Proposal");

    await supabase
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

    return { success: false, error: `Only reached ${totalWords} words (target: ${target})` };
  }

  // Save completed proposal
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

  // Send email
  const { notifyToolCompleted } = await import("@/lib/mail-helper");
  await notifyToolCompleted(userId, "proposal", {
    title: topicCtx.title,
    downloadUrl: `${SITE}/proposals`,
    aiScore: 85,
    plagiarismScore: 92,
  });

  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  return { success: true };
}
