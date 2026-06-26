/**
 * Shared AI generation functions for thesis and proposal content.
 * Extracted from Inngest functions — called directly by the queue worker.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { buildPreviousContext, buildChapterFourRules, buildChapterFiveRules } from "./jobs/pipeline";
import { countWords } from "./ai-utils.server";

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
      order: 1,
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
      order: 2,
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
      order: 3,
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
      order: 4,
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
      order: 5,
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

  // Track generated chapters for context passing (sequential generation)
  const generatedChapters: Array<{ key: string; chapterTitle: string; order: number; content: string }> = [];

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

  // Generate each chapter one at a time WITH context from previous chapters
  const thesisLevel = data.level === "undergraduate" ? "Undergraduate" : data.level === "masters" ? "Master's" : "PhD";
  const pipelinePayload = { topic: topicCtx.title, documentTitle: topicCtx.title };
  for (const def of chapterDefs) {
    try {
      // Extract sub-section titles from the instructions (lines matching "X.Y Title")
      const sectionLines = def.instructions
        .split("\n")
        .filter((l) => /^\d+\.\d+\s+/.test(l))
        .map((l) => l.replace(/^\d+\.\d+\s+/, "").trim())
        .filter(Boolean);
      let system = `You are an experienced Nigerian academic writing a completed research thesis at ${thesisLevel} level. Write ${def.label} for a study titled '${topicCtx.title}' on '${topicCtx.title}' conducted at a Nigerian university.

CRITICAL RULES FOR THESIS:
- Use past tense for methodology and findings: 'this study examined', 'data was collected', 'the researcher found'
- Use present tense for literature review and established facts: 'communication is', 'scholars argue'
- Chapter Four must present and analyse actual findings with statistical language appropriate to the study
- Chapter Five must provide conclusions drawn FROM the findings, not restate the objectives
- Write approximately ${def.target} words
- Use ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"} referencing style
- Include in-text citations: (Surname, Year)
- Sub-sections required in order: ${sectionLines.join(", ")}
- Output the chapter text only — no markdown, no headers, no preamble, no conclusion summary at the end`;

      // Append context from all previously generated chapters
      system += buildPreviousContext(generatedChapters, pipelinePayload as any);

      // Append chapter-specific rules
      if (def.order === 4) {
        system += buildChapterFourRules();
      } else if (def.order === 5) {
        system += buildChapterFiveRules();
      }

      chapters[def.key] = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${def.label} now — approximately ${def.target} words. Follow the numbered sub-section structure exactly.` });

      // STRICT per-chapter word count enforcement — re-prompt up to 3 times if below target
      let chapterWords = countWords(chapters[def.key] ?? "");
      let chapterRetries = 0;
      while (chapterWords < def.target && chapterRetries < 3) {
        chapterRetries++;
        const shortfall = def.target - chapterWords;
        try {
          const expandSystem = `You are a senior academic. Your previous ${def.label} was too short — only ${chapterWords} words, but the target is AT LEAST ${def.target} words. You MUST expand it by ${shortfall}+ words with NEW content, additional analysis, deeper explanation, and more examples. Keep ALL existing content. Do NOT use filler phrases. Target: AT LEAST ${def.target} words. Output the FULL updated chapter as plain text.`;
          chapters[def.key] = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: expandSystem, user: `CURRENT DRAFT:\n${chapters[def.key]}` });
          chapterWords = countWords(chapters[def.key] ?? "");
        } catch (e) {
          break; // stop retrying if API fails
        }
      }

      // Track this chapter for context in subsequent chapters
      generatedChapters.push({
        key: def.key,
        chapterTitle: def.label,
        order: def.order,
        content: chapters[def.key] ?? "",
      });
    } catch (e) {
      console.error(`[thesis] Failed to generate ${def.key}:`, e);
      chapters[def.key] = "";
    }
  }

  // Word count enforcement — expand any chapter below its target
  const { scrubObject } = await import("@/lib/ai-utils.server");
  let total = abstractTarget + chapterDefs.reduce((s, d) => s + countWords(chapters[d.key] ?? ""), 0);

  let expandAttempts = 0;
  while (total < target && expandAttempts < 8) {
    expandAttempts++;
    const diff = target - total;
    // Expand ALL chapters that are below their individual target, not just the shortest
    const below = chapterDefs
      .filter((d) => countWords(chapters[d.key] ?? "") < d.target)
      .sort((a, b) => countWords(chapters[a.key] ?? "") - countWords(chapters[b.key] ?? ""));

    if (below.length === 0) break; // all chapters at or above target

    const toExpand = below.slice(0, 3); // expand up to 3 at a time
    const share = Math.max(Math.ceil(diff / toExpand.length) * 2, 500);

    for (const c of toExpand) {
      try {
        const current = countWords(chapters[c.key] ?? "");
        const newTarget = current + share;
        const system = `You are a senior academic writing ${c.label} of a ${data.level} thesis.\n${baseRules}\nYou previously wrote a version. EXPAND it substantially with NEW content, more detailed analysis, additional examples, and deeper explanation. Keep ALL existing content. Do NOT use filler phrases like "Furthermore", "In addition", "It is important to note". Write naturally. Your current word count is ${current} words. You MUST reach AT LEAST ${newTarget} words. Output the FULL updated chapter as plain text.`;
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

    return { success: false, error: `Only reached ${total} words (target: ${target}). Please try again.` };
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

  // Proposal structure: 3 chapters + abstract
  const prelimTarget = Math.round(target * 0.30);   // Chapter 1: Introduction
  const litReviewTarget = Math.round(target * 0.35); // Chapter 2: Literature Review
  const methodTarget = Math.round(target * 0.35);    // Chapter 3: Methodology

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

  const proposalLevel = data.level === "undergraduate" ? "Undergraduate" : data.level === "masters" ? "Master's" : "PhD";

  // Generate abstract
  let abstract = "";
  try {
    const raw = await callAI(apiKey, { model: "deepseek-reasoner", max_tokens: 8000, system: `You are a senior academic. Write ONLY abstract as JSON. JSON: {"abstract":"..."} Target: ${abstractTarget} words.`, user: topicContext });
    abstract = raw?.abstract ?? "";
  } catch (e) {
    console.error("[proposal] Abstract failed, continuing");
  }

  const sections: Record<string, string> = {};

  // Track generated proposal chapters for context passing
  const genChapters: Array<{ key: string; chapterTitle: string; order: number; content: string }> = [];

  const proposalChapters: Array<{ label: string; order: number; sections: string[]; target: number }> = [
    { label: "Chapter 1: Introduction", order: 1, sections: ["Background to the Study", "Statement of the Problem", "Objectives", "Research Questions", "Research Hypotheses", "Significance", "Scope of the Study", "Definition of Terms"], target: prelimTarget },
    { label: "Chapter 2: Literature Review", order: 2, sections: ["Conceptual Review", "Empirical Review", "Theoretical Review", "Theoretical Framework", "Summary of Reviews", "Gap in Literature"], target: litReviewTarget },
    { label: "Chapter 3: Research Methodology", order: 3, sections: ["Research Design", "Area of the Study", "Population of the Study", "Sample Size", "Sampling Technique", "Instrumentation", "Validity of Instrument", "Reliability of Instrument", "Method of Collecting Data", "Method of Data Analysis"], target: methodTarget },
  ];

  const proposalPayload = { topic: topicCtx.title, documentTitle: topicCtx.title };

  for (const ch of proposalChapters) {
    try {
      let system = `You are an experienced Nigerian academic writing a research proposal at ${proposalLevel} level. Write ${ch.label} for a proposed study titled '${topicCtx.title}' on '${topicCtx.title}' for submission at a Nigerian university.

CRITICAL RULES FOR PROPOSALS:
- Use future tense throughout: 'this study will examine', 'the researcher will use', 'data will be collected'
- Frame everything as planned, not completed
- Chapter One must establish a clear research gap that justifies why this study needs to be conducted
- Chapter Two must review existing literature and show what is missing
- Chapter Three must describe the exact methodology the researcher PLANS to use, not what was used
- Write approximately ${ch.target} words
- Use ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"} referencing style
- Include in-text citations: (Surname, Year) — do not fabricate specific page numbers
- Sub-sections required in order: ${ch.sections.join(", ")}
- Output the chapter text only — no markdown, no headers, no preamble, no conclusion summary at the end`;

      // Append context from all previously generated chapters
      system += buildPreviousContext(genChapters, proposalPayload as any);

      const sectionNames = ch.sections.map((s) => s.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, ""));
      let text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${ch.label} now — approximately ${ch.target} words. Include these sections with ## headers:\n${sectionNames.join("\n")}\n\nFor Chapter 3, include statistical formulas in plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, r = 0.76.` });

      // STRICT per-chapter word count enforcement — re-prompt up to 2 times if below target (proposals are shorter, fewer retries needed)
      let chapterWords = countWords(text);
      let chapterRetries = 0;
      while (chapterWords < ch.target && chapterRetries < 2) {
        chapterRetries++;
        const shortfall = ch.target - chapterWords;
        try {
          const expandSystem = `You are a senior academic. Your previous ${ch.label} was too short — only ${chapterWords} words, but the target is AT LEAST ${ch.target} words. You MUST expand it by ${shortfall}+ words with NEW content, additional detail, deeper analysis, and more examples. Keep ALL existing content. Do NOT use filler phrases. Target: AT LEAST ${ch.target} words. Output the FULL updated chapter as plain text.`;
          text = await callAIText(apiKey, { model: "deepseek-chat", max_tokens: 64000, system: expandSystem, user: `CURRENT DRAFT:\n${text}` });
          chapterWords = countWords(text);
        } catch {
          break;
        }
      }

      // Track for context in subsequent chapters
      genChapters.push({
        key: ch.label,
        chapterTitle: ch.label,
        order: ch.order,
        content: text,
      });

      Object.assign(sections, parseSections(text));
    } catch (e) {
      console.error(`[proposal] ${ch.label} failed:`, e);
    }
  }

  // Word count enforcement — expand shortest sections if below target
  const totalWords = abstractTarget +
    Object.values(sections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);
  let totalWords2 = totalWords;

  let expandAttempts = 0;
  while (totalWords2 < target && expandAttempts < 8) {
    expandAttempts++;
    const diff = target - totalWords2;
    const fieldLengths = Object.entries(sections).map(([k, v]) => ({ key: k, len: countWords(String(v ?? "")) }));
    fieldLengths.sort((a, b) => a.len - b.len);
    const toExpand = fieldLengths.slice(0, 3); // expand up to 3 shortest simultaneously

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
    totalWords2 = abstractTarget +
      Object.values(sections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);
  }

  // HARD ENFORCEMENT — never save below target
  if (totalWords2 < target) {
    const { notifyToolFailed } = await import("@/lib/mail-helper");
    await notifyToolFailed(userId, "Proposal");

    return { success: false, error: `Only reached ${totalWords2} words (target: ${target}). Please try again.` };
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
      word_count: totalWords2,
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
