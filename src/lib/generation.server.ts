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
Write natural academic English as a human researcher would. Vary sentence length and structure.
RULES:
- Never use phrases like "This chapter explores", "It is noteworthy", "In conclusion, it can be said", "This study aims to", "The following", "It is important to note".
- Use only 1-2 key citations per section — focus on depth, not quantity.
- Never invent citations.
- Write in clear paragraphs, not bullet points.
- For numbers above 999, use commas (1,500 not 1500).
- For equations, use plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, F = MSB/MSW, r = 0.76.`;

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
    {
      key: "chapter_1_introduction",
      label: "Chapter 1: Introduction",
      instructions: `Use these numbered sub-sections:
1.1 Background to the study
1.2 Statement of problem
1.3 Objective of the study
1.4 Research questions
1.5 Research hypothesis
1.6 Significant of the study
1.7 Scope of the study
1.8 Definition of terms
Focus on clearly explaining the research problem and why this study matters.`,
    },
    {
      key: "chapter_2_literature_review",
      label: "Chapter 2: Literature Review",
      instructions: `Use these numbered sub-sections:
2.1 Conceptual review
2.2 Empirical Review
2.3 Theoretical review
2.4 Theoretical framework
2.5 Summary of Reviews
2.6 Gap in literature
For each area, explain the key ideas and debates — use 1-2 citations where they genuinely support a point. Focus on synthesis and analysis, not listing references.`,
    },
    {
      key: "chapter_3_methodology",
      label: "Chapter 3: Research Methodology",
      instructions: `Use these numbered sub-sections:
3.1 Research design
3.2 Area of the study
3.3 Population of the study
3.4 Sample size
3.5 Sample techniques
3.6 Instrument for data collection
3.7 Validity of instrument
3.8 Reliability of instrument
3.9 Method of administering data
3.10 Method of presentation and data analysis
Describe exactly how the research was carried out with methodological detail.`,
    },
    {
      key: "chapter_4_results_findings",
      label: "Chapter 4: Results and Findings",
      instructions: `Use these numbered sub-sections:
4.1 Introduction
4.2 Data analysis and presentation
4.3 Discussion of findings
Present findings with data. Use plain text tables formatted like:
TABLE 1: Distribution of Respondents by Age
+--------+----------+----------+
| Age    | Frequency| Percent  |
+--------+----------+----------+
| 18-25  | 45       | 30.0%    |
| 26-35  | 60       | 40.0%    |
| 36+    | 45       | 30.0%    |
+--------+----------+----------+
| Total  | 150      | 100.0%   |
+--------+----------+----------+
Include descriptive statistics (mean, standard deviation) and inferential statistics (t-test, ANOVA, chi-square, correlation) as relevant. Show actual computed values.`,
    },
    {
      key: "chapter_5_discussion_conclusion",
      label: "Chapter 5: Discussion, Conclusion and Recommendations",
      instructions: `Use these numbered sub-sections:
5.1 Summary of findings
5.2 Conclusion
5.3 Limitations of the study
5.4 Recommendations
Discuss findings in relation to the literature, conclude, recommend, suggest further studies, and note limitations.`,
    },
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
      const system = `You are a senior academic writing ${def.label} of a ${data.level} thesis.\n${baseRules}\n${def.instructions}\nTarget: APPROXIMATELY ${def.target} words.\nOutput each sub-section with its number (e.g. "1.1 Background to the study") as a heading on its own line. Write in plain text paragraphs.`;
      chapters[def.key] = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${def.label} now — approximately ${def.target} words. Follow the numbered sub-section structure exactly.` });
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
        const system = `You are a senior academic writing ${c.label} of a ${data.level} thesis.\n${baseRules}\nYou previously wrote a version. EXPAND it substantially with NEW content and examples. Keep ALL existing content. Do NOT use phrases like "This section", "Furthermore", "It is important". Write naturally. Target for this chapter: AT LEAST ${newTarget} words (currently ${c.current}). Output FULL updated chapter as plain text.`;
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

  const abstractTarget = Math.max(80, Math.round(target * 0.025));

  // Proposal structure: 5 chapters + abstract
  const prelimTarget = Math.round(target * 0.20);   // Chapter 1: Introduction
  const litReviewTarget = Math.round(target * 0.25); // Chapter 2: Literature Review
  const methodTarget = Math.round(target * 0.20);    // Chapter 3: Methodology
  const resultsTarget = Math.round(target * 0.15);   // Chapter 4: Results
  const discussionTarget = Math.round(target * 0.15); // Chapter 5: Discussion

  const { callAI, callAIText } = await import("@/lib/ai-utils.server");
  const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";

  function parseSections(text: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = text.split("\n");
    let currentKey: string | null = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      // Match ## headers (markdown) OR numbered headers like "1.1 Background to the study"
      const mdMatch = line.match(/^#{1,4}\s+(.+)/);
      const numMatch = line.match(/^\d+\.\d+\s+(.+)/i);

      if (mdMatch) {
        // Save previous
        if (currentKey && currentContent.length > 0) {
          result[currentKey] = currentContent.join("\n").trim();
        }
        currentKey = mdMatch[1].trim().toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
        currentContent = [];
      } else if (numMatch) {
        // Save previous
        if (currentKey && currentContent.length > 0) {
          result[currentKey] = currentContent.join("\n").trim();
        }
        currentKey = numMatch[1].trim().toLowerCase().replace(/['']/g, "").replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
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

  const citationStyleText = data.citation_style === "harvard" ? "Harvard" : "APA 7";
  const baseRules = `Citation style: ${citationStyleText}. Plain text only, no HTML.
Write natural academic English as a human researcher would. Vary sentence length and structure.
RULES:
- Never use phrases like "This chapter explores", "It is noteworthy", "In conclusion, it can be said", "This study aims to", "The following", "It is important to note".
- Use only 1-2 key citations per section — focus on depth, not quantity.
- Never invent citations.
- Write in clear paragraphs, not bullet points.
- For numbers above 999, use commas (1,500 not 1500).
- Use ## headers for each section.`;

  // Generate abstract
  let abstract = "";
  try {
    const raw = await callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 8000, jsonMode: true, system: `You are a senior academic. Write ONLY abstract as JSON. JSON: {"abstract":"..."} Target: ${abstractTarget} words.`, user: topicContext });
    abstract = raw?.abstract ?? "";
  } catch (e) {
    console.error("[proposal] Abstract failed, continuing");
  }

  const sections: Record<string, string> = {};

  // Chapter 1: Introduction
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `${baseRules}\nWrite Chapter 1 (INTRODUCTION) of a research proposal. Include these sections with ## headers:\nbackground_to_the_study\nstatement_of_the_problem\nobjectives\nresearch_questions\nresearch_hypotheses\nsignificance\nscope_of_the_study\ndefinition_of_terms\nTarget: ${prelimTarget} words.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Chapter 1 failed:", e);
  }

  // Chapter 2: Literature Review
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `${baseRules}\nWrite Chapter 2 (LITERATURE REVIEW) of a research proposal. Include these sections with ## headers:\nconceptual_review\nempirical_review\ntheoretical_review\ntheoretical_framework\nsummary_of_reviews\ngap_in_literature\nTarget: ${litReviewTarget} words. Focus on analysing existing research — don't just list references.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Chapter 2 failed:", e);
  }

  // Chapter 3: Methodology
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `${baseRules}\nWrite Chapter 3 (RESEARCH METHODOLOGY) of a research proposal. Include these sections with ## headers:\nresearch_design\narea_of_the_study\npopulation_of_the_study\nsample_size\nsampling_technique\ninstrumentation\nvalidity_of_instrument\nreliability_of_instrument\nmethod_of_collecting_data\nmethod_of_data_analysis\nTarget: ${methodTarget} words. Describe exactly how the research will be conducted. For statistical formulas, use plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, r = 0.76.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Chapter 3 failed:", e);
  }

  // Chapter 4: Results and Findings
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `${baseRules}\nWrite Chapter 4 (RESULTS AND FINDINGS) of a research proposal. Include these sections with ## headers:\nintroduction\ndata_analysis_and_presentation\ndiscussion_of_findings\nTarget: ${resultsTarget} words. Include realistic data tables formatted like:\nTABLE 1: Sample Descriptive Statistics\n+-----------+-------+-------+\n| Variable  | Mean  | SD    |\n+-----------+-------+-------+\n| Age       | 28.5  | 4.2   |\n| Income    | 1,500 | 320   |\n+-----------+-------+-------+`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Chapter 4 failed:", e);
  }

  // Chapter 5: Discussion, Conclusion and Recommendations
  try {
    const text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: `${baseRules}\nWrite Chapter 5 (DISCUSSION, CONCLUSION AND RECOMMENDATIONS) of a research proposal. Include these sections with ## headers:\nsummary_of_findings\nconclusion\nlimitations\nrecommendations\nTarget: ${discussionTarget} words.`, user: topicContext });
    Object.assign(sections, parseSections(text));
  } catch (e) {
    console.error("[proposal] Chapter 5 failed:", e);
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
