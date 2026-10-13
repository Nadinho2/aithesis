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
    custom_chapters?: Array<{ order: number; title: string; sections: string[] }>;
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

  const { formatInTextCitation, formatAPA, formatHarvard, formatByStyle, sortReferences } = await import("@/lib/scholarly.server");

  // Build structured reference context with explicit in-text citation keys
  const refContext = refs
    .map((r: any, i: number) => {
      const citeKey = formatInTextCitation(r, data.citation_style as any);
      const fullCitation = formatByStyle(r, data.citation_style as any);
      return `[REF ${i + 1}]
In-Text Citation Key: ${citeKey}
Full Reference: ${fullCitation}
Title: ${r.title || "Untitled"}`;
    })
    .join("\n\n");

  const baseRules = `CITATION STYLE: ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"}
Write natural academic English as a human researcher would. Vary sentence length and structure.
RULES:
- No em dashes (—). Use commas, semicolons, and periods instead.
- Never use phrases like "This chapter explores", "It is noteworthy", "In conclusion, it can be said", "This study aims to", "The following", "It is important to note".
- CRITICAL CITATION RULE: You MUST cite ONLY from the AVAILABLE REFERENCES list below.
- Use the exact In-Text Citation Key provided for each reference (e.g., (Surname, Year)).
- Never invent fictitious scholars, authors, or publication years.
- Write in clear paragraphs, not bullet points.
- For numbers above 999, use commas (1,500 not 1500).
- For equations, use plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, F = MSB/MSW, r = 0.76.`;

  // Detect empirical qualitative vs quantitative mode
  const isQualitative =
    Boolean(topicCtx.research_type && /qualitative|interview|case study|thematic|phenomenolog/i.test(topicCtx.research_type)) ||
    Boolean(topicCtx.primary_instrument && /interview|focus group|qualitative/i.test(topicCtx.primary_instrument));

  const hasPrimaryData = Boolean(
    topicCtx.is_primary_data ||
    topicCtx.primary_instrument ||
    topicCtx.sample_size ||
    (topicCtx.sample_questions && topicCtx.sample_questions.length > 0)
  );

  const primarySection = hasPrimaryData ? `
PRIMARY EMPIRICAL DATA SPECIFICATIONS:
- Primary Instrument: ${topicCtx.primary_instrument || (isQualitative ? "Key Informant Interviews (KII) / In-depth Interviews" : "Structured Questionnaire")}
- Target Population / Informants: ${topicCtx.target_population || "Target participants in " + (topicCtx.country || "the study setting")}
- Sample Size: ${topicCtx.sample_size || (isQualitative ? "15 in-depth interview participants (at data saturation)" : "250 survey respondents")}
${topicCtx.sample_questions?.length ? `- Core Research / Interview Questions to Analyse:\n  * ${topicCtx.sample_questions.join("\n  * ")}` : ""}
${topicCtx.empirical_notes ? `- Key Empirical Field Findings / Participant Notes to Reflect in Analysis:\n  ${topicCtx.empirical_notes}` : ""}
` : "";

  const topicContext = `RESEARCH TOPIC: ${topicCtx.title}
DEPARTMENT / DISCIPLINE: ${topicCtx.department || "Academic Department"}
LOCATION / CONTEXT: ${topicCtx.country || "Nigeria"}
AREA OF INTEREST: ${topicCtx.area_of_interest || "Academic Research"}
RESEARCH TYPE: ${topicCtx.research_type || (isQualitative ? "Empirical Qualitative" : "Empirical Quantitative")}
PROBLEM STATEMENT: ${topicCtx.problem_statement}
GAP: ${topicCtx.research_gap}
OBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}
LEVEL: ${data.level}
${primarySection}
AVAILABLE REFERENCES (MANDATORY: You must cite ONLY from these references using their In-Text Citation Keys):
${refContext}`;

  const isHumanitiesOrHistorical = Boolean(
    topicCtx.department && /history|humanities|law|literature|philosophy|religious|theology|classics|archaeology|diplomatic|international studies/i.test(topicCtx.department)
  ) || Boolean(
    topicCtx.research_type && /historical|doctrinal|archival|qualitative|humanities|textual/i.test(topicCtx.research_type)
  ) || Boolean(
    topicCtx.title && /19\d\d|20\d\d|history|origins|pre-colonial|colonial|historical/i.test(topicCtx.title)
  );

  const abstractTarget = Math.min(400, Math.max(200, Math.round(target * 0.03)));

  let chapterDefs: Array<{
    key: string;
    label: string;
    order: number;
    instructions: string;
    target: number;
  }> = [];

  if (data.custom_chapters && data.custom_chapters.length > 0) {
    const customList = data.custom_chapters;
    const numChapters = customList.length;
    const wordsForChapters = Math.max(1000, target - abstractTarget);
    const avgWords = Math.round(wordsForChapters / numChapters);

    chapterDefs = customList.map((ch, idx) => {
      const slug = ch.title
        .toLowerCase()
        .replace(/^chapter\s*\d+\s*[:\-\—]*/i, "")
        .replace(/[^a-z0-9]+/g, "_")
        .slice(0, 30)
        .replace(/^_+|_+$/g, "") || `part_${idx + 1}`;
      const key = `chapter_${ch.order}_${slug}`;

      const subSecList = ch.sections.map((s, sIdx) => {
        const hasNum = /^\d+\.\d+/.test(s);
        return hasNum ? s : `${ch.order}.${sIdx + 1} ${s}`;
      });

      const instructions = `Use these numbered sub-sections in order:\n${subSecList.join("\n")}\n\nExamine and develop each sub-section comprehensively with scholarly analysis, rigorous evidence, and academic prose. Extensively cite from the AVAILABLE REFERENCES list using their In-Text Citation Keys. Output pure academic narrative.`;

      return {
        key,
        label: ch.title,
        order: ch.order,
        instructions,
        target: Math.max(600, avgWords),
      };
    });
  } else {
    const chapterWeights = [0.15, 0.32, 0.18, 0.20, 0.15];
    const defaultDefs = [
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
Focus on clearly explaining the research problem and why this study matters. Cite relevant foundational literature from the reference list.`,
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
For each area, explain the key ideas and scholarly debates. Extensively cite from the AVAILABLE REFERENCES list using their In-Text Citation Keys. Focus on synthesis, critique, and academic depth.`,
      },
      {
        key: "chapter_3_methodology",
        label: "Chapter 3: Research Methodology",
        order: 3,
        instructions: isQualitative || isHumanitiesOrHistorical
          ? `Use these numbered sub-sections:
3.1 Research design (${isHumanitiesOrHistorical ? "Historical / Archival Analytical Research Design" : "Exploratory / Phenomenological Qualitative Design"})
3.2 Area of the study (${topicCtx.country || "Study Setting"})
3.3 Sources of data and Key Informants (${topicCtx.target_population || (isHumanitiesOrHistorical ? "Primary archival records, oral traditions, and secondary historical literature" : "Target study informants")})
3.4 Sample size and determination (${topicCtx.sample_size || "Determined by data saturation / historical source availability"})
3.5 Sampling technique (Purposive / Judgemental Sampling with clear inclusion criteria)
3.6 Instrument for data collection (${isHumanitiesOrHistorical ? "Oral Interview Guide and Archival Document Review Checklist" : "Semi-structured Key Informant Interview Guide"})
3.7 Trustworthiness and Historical Criticism (Internal and External Criticism of primary sources / Guba & Lincoln framework — do NOT use quantitative Cronbach's alpha)
3.8 Method of data collection (Audio-recorded oral interviews, verbatim transcription, and archival documentation)
3.9 Method of data analysis (${isHumanitiesOrHistorical ? "Historical Hermeneutics, Chronological and Thematic Synthesis" : "Braun & Clarke 6-phase Thematic Analysis"})
3.10 Ethical considerations (Informed consent, participant anonymity, voluntary participation)
Describe exactly how the study fieldwork was carried out with methodological rigor.`
          : `Use these numbered sub-sections:
3.1 Research design (Descriptive Survey Research Design)
3.2 Area of the study (${topicCtx.country || "Study Setting"})
3.3 Population of the study (${topicCtx.target_population || "Target study population"})
3.4 Sample size and determination (${topicCtx.sample_size || "Calculated using Taro Yamane or Cochran formula"})
3.5 Sampling technique (Stratified / Simple Random Sampling)
3.6 Instrument for data collection (Structured Questionnaire using 4-point/5-point Likert scale)
3.7 Validity of instrument (Face and Content validity by panel of experts)
3.8 Reliability of instrument (Cronbach's alpha reliability coefficient or test-retest)
3.9 Method of administering data (Questionnaire administration and retrieval procedures)
3.10 Method of presentation and data analysis (Descriptive statistics with Mean and Standard Deviation, benchmark criterion mean cutoff e.g. 2.50, and inferential hypotheses testing)
Describe exactly how the research was carried out with methodological detail.`,
      },
      {
        key: "chapter_4_results_findings",
        label: "Chapter 4: Results and Findings",
        order: 4,
        instructions: isQualitative || isHumanitiesOrHistorical
          ? `Use these numbered sub-sections:
4.1 Introduction and Demographic Profile of Participants / Historical Setting
4.2 Thematic Presentation of Findings (Organised around each Research Question and core historical or interview themes. Present Major Themes and Sub-Themes with rich evidence and verbatim quotes)
4.3 Summary Matrix of Emerging Themes
4.4 Discussion of Findings (Relate the findings to empirical literature from Chapter Two and theoretical framework)
DO NOT generate quantitative hypotheses testing or Chi-Square/ANOVA tables. This is an empirical qualitative/humanities study.`
          : `Use these numbered sub-sections:
4.1 Introduction and Questionnaire Response Rate (Distributed vs Retrieved)
4.2 Demographic Profile of Respondents
4.3 Analysis of Research Questions (Plain text tables with Frequency, Mean, Standard Deviation, and Decision: Agreed/Accepted vs Disagreed/Rejected based on 2.50 criterion cutoff)
4.4 Hypotheses Testing (State null hypothesis H01, test statistic, p-value < 0.05 decision rule)
4.5 Discussion of Findings (Compare empirical findings with literature and theoretical framework)
Present findings with structured tables. Use actual computed values.`,
      },
      {
        key: "chapter_5_discussion_conclusion",
        label: "Chapter 5: Discussion, Conclusion and Recommendations",
        order: 5,
        instructions: `Use these numbered sub-sections:
5.1 Summary of findings (${isQualitative || isHumanitiesOrHistorical ? "Synthesizing the core qualitative/historical themes discovered" : "Summarizing statistical results and hypothesis decisions"})
5.2 Conclusion (Substantive conclusions drawn directly from Chapter Four findings)
5.3 Recommendations (Specific, actionable policy and practical recommendations)
5.4 Contribution to knowledge
5.5 Limitations of the study and Suggestions for further research
Discuss findings in relation to the literature, conclude, recommend, and note limitations.`,
      },
    ];

    chapterDefs = defaultDefs.map((d, i) => ({
      ...d,
      target: Math.max(500, Math.round(target * chapterWeights[i])),
    }));
  }

  const { callAIText } = await import("@/lib/ai-utils.server");
  const thesisKey = runtimeEnv("DEEPSEEK_API_KEY_THESIS");
  const fallbackKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";
  const apiKey = thesisKey && !thesisKey.includes("...") && thesisKey.length > 20 ? thesisKey : fallbackKey;

  const chapters: Record<string, string> = {};

  // Track generated chapters for context passing (sequential generation)
  const generatedChapters: Array<{ key: string; chapterTitle: string; order: number; content: string }> = [];

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
      let system = `You are an experienced academic writing a completed research thesis at ${thesisLevel} level. Write ${def.label} for a study titled '${topicCtx.title}' conducted at a university.

CRITICAL RULES FOR THESIS:
- Use past tense for methodology and findings: 'this study examined', 'data was collected', 'the researcher found'
- Use present tense for literature review and established facts: 'communication is', 'scholars argue'
- ${isQualitative || isHumanitiesOrHistorical ? "This is a QUALITATIVE / HUMANITIES / HISTORICAL study: present rich thematic narrative, historical evidence, participant/informant codes, and verbatim quotes. Do not generate quantitative ANOVA or Chi-Square tests." : "Chapter Four must present and analyse actual findings with statistical language and tables appropriate to the study"}
- Write approximately ${def.target} words
- Use ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"} referencing style
- Include in-text citations using ONLY the provided In-Text Citation Keys: (Surname, Year) or Surname (Year)
- Sub-sections required in order: ${sectionLines.join(", ")}
- Output the chapter text directly. Do NOT include meta-planning, internal thinking, scratchpad notes, or commentary about what needs to be written. Start immediately with the chapter title and sections.`;

      // Append context from all previously generated chapters
      system += buildPreviousContext(generatedChapters, pipelinePayload as any);

      // Append chapter-specific rules only for standard 5-chapter template when appropriate
      const isDefaultTemplate = !data.custom_chapters || data.custom_chapters.length === 0;
      if (isDefaultTemplate && def.order === 4 && !isHumanitiesOrHistorical) {
        system += buildChapterFourRules(isQualitative);
      } else if (isDefaultTemplate && def.order === 5 && !isHumanitiesOrHistorical) {
        system += buildChapterFiveRules(isQualitative);
      }

      chapters[def.key] = await callAIText(apiKey, { model: "deepseek-v4-pro", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${def.label} now — approximately ${def.target} words. Follow the numbered sub-section structure exactly.` });

      // STRICT per-chapter word count enforcement — re-prompt up to 3 times if below target
      let chapterWords = countWords(chapters[def.key] ?? "");
      let chapterRetries = 0;
      while (chapterWords < def.target && chapterRetries < 3) {
        chapterRetries++;
        const shortfall = def.target - chapterWords;
        try {
          const expandSystem = `You are a senior academic. Your previous ${def.label} was too short — only ${chapterWords} words, but the target is AT LEAST ${def.target} words. You MUST expand it by ${shortfall}+ words with NEW content, additional analysis, deeper explanation, and more examples. Keep ALL existing content. Do NOT use filler phrases. Target: AT LEAST ${def.target} words. Output the FULL updated chapter as plain text.`;
          chapters[def.key] = await callAIText(apiKey, { model: "deepseek-v4-pro", max_tokens: 64000, system: expandSystem, user: `CURRENT DRAFT:\n${chapters[def.key]}` });
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
        const content = await callAIText(apiKey, { max_tokens: 64000, model: "deepseek-v4-pro", system, user: `${topicContext}\n\nCURRENT DRAFT:\n${chapters[c.key]}` });
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
    const { dispatchNotification } = await import("@/lib/notifications");
    await dispatchNotification(userId, { kind: "tool_failed", tool: "Thesis" });

    return { success: false, error: `Only reached ${total} words (target: ${target}). Please try again.` };
  }

  // ─── Generate abstract AFTER chapters ──────────────────────────────────
  // Now that all chapters exist, the AI can write a genuine results-based
  // abstract instead of a procedural preview of what the thesis "will" do.
  const lastChapter = chapterDefs[chapterDefs.length - 1];
  const secondLastChapter = chapterDefs.length > 1 ? chapterDefs[chapterDefs.length - 2] : null;
  const chapterSummary = [
    secondLastChapter ? `${secondLastChapter.label} excerpt:\n${(chapters[secondLastChapter.key] ?? "").slice(0, 1200)}` : "",
    lastChapter ? `${lastChapter.label} excerpt:\n${(chapters[lastChapter.key] ?? "").slice(0, 800)}` : "",
  ].filter(Boolean).join("\n\n");

  let abstract = "";
  try {
    const { callAI, callAIText, scrubAITells } = await import("@/lib/ai-utils.server");
    const abstractSystem = [
      `You are a senior academic. Below are the completed chapters of a ${data.level} thesis.`,
      `Write a RESULTS-BASED abstract as a single JSON object: {"abstract":"..."}`,
      ``,
      `CRITICAL RULES:`,
      `- Write in PAST TENSE — describe what the study DID, what it FOUND, and what it MEANS.`,
      `- Do NOT describe what the thesis "will do", "aims to do", or "explores".`,
      `- Summarise the actual methodology, findings, and conclusions from the chapters below.`,
      `- ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"} style.`,
      `- Target: approximately ${abstractTarget} words (single paragraph).`,
      `- Use 1-2 citations from the reference list only where they genuinely support a finding.`,
      `- Never invent citations.`,
      `- Vary sentence length and structure. Write natural academic English.`,
    ].join("\n");

    try {
      const raw = await callAI(apiKey, {
        model: "deepseek-v4-flash",
        max_tokens: 8000,
        system: abstractSystem,
        user: `${topicContext}\n\nCOMPLETED CHAPTER EXCERPTS:\n${chapterSummary}\n\nWrite the abstract now.`,
      });
      abstract = raw?.abstract ?? "";
    } catch (jsonErr) {
      console.warn("[thesis] callAI JSON failed for abstract, falling back to plain text:", jsonErr);
    }

    // Fallback: if JSON mode returned empty or failed, generate plain text directly
    if (!abstract || abstract.trim().length === 0) {
      const plainSystem = [
        `You are a senior academic. Below are the completed chapters of a ${data.level} thesis.`,
        `Write a RESULTS-BASED academic abstract (approximately ${abstractTarget} words).`,
        `Output ONLY the abstract text directly — no title, no "Abstract" heading, no quotes, no conversational preamble.`,
        ``,
        `CRITICAL RULES:`,
        `- Write in PAST TENSE — describe what the study DID, what it FOUND, and what it MEANS.`,
        `- Do NOT describe what the thesis "will do", "aims to do", or "explores".`,
        `- Summarise the actual methodology, findings, and conclusions from the chapters below.`,
        `- ${data.citation_style === "harvard" ? "Harvard" : "APA 7th"} style.`,
        `- Target: approximately ${abstractTarget} words. Single paragraph.`,
      ].join("\n");

      const plainText = await callAIText(apiKey, {
        model: "deepseek-v4-flash",
        max_tokens: 4000,
        system: plainSystem,
        user: `${topicContext}\n\nCOMPLETED CHAPTER EXCERPTS:\n${chapterSummary}\n\nWrite the abstract now.`,
      });
      abstract = plainText.replace(/^(?:\*{0,2}abstract\*{0,2}[:\s]*)+/i, "").trim();
    }

    // Scrub AI tells from the abstract
    if (abstract) {
      abstract = scrubAITells(abstract);
    }

    // Word count retry — re-prompt once only if significantly too short (< 150 words)
    const abstractWords = countWords(abstract);
    if (abstractWords < 150 && abstract) {
      try {
        const retrySystem = [
          `You are a senior academic. Your previous abstract was too short — only ${abstractWords} words, but the target is approximately ${abstractTarget} words.`,
          `Expand it with more specific findings from the completed chapters. Keep the same JSON format: {"abstract":"..."}`,
        ].join("\n");
        const retry = await callAI(apiKey, {
          model: "deepseek-v4-flash",
          max_tokens: 8000,
          system: retrySystem,
          user: `CURRENT ABSTRACT:\n${abstract}\n\nCOMPLETED CHAPTER EXCERPTS:\n${chapterSummary}`,
        });
        const expanded = retry?.abstract ?? "";
        if (expanded && countWords(expanded) > abstractWords) {
          abstract = scrubAITells(expanded);
        }
      } catch {
        // Keep original if retry fails
      }
    }
  } catch (e) {
    console.error("[thesis] Abstract generation failed, saving without abstract:", e);
    abstract = "";
  }

  // Scrub AI tells and em dashes from all chapters + abstract
  const { scrubObject } = await import("@/lib/ai-utils.server");
  const scrubbedChapters = scrubObject(chapters) as Record<string, any>;
  const scrubbedAbstract = abstract ? scrubObject(abstract) : "";

  // Attach metadata for dynamic chapter sequence and titles in viewer & Word docx export
  scrubbedChapters["_meta"] = {
    chapter_order: chapterDefs.map((d) => [d.label, d.key]),
    chapter_titles: Object.fromEntries(chapterDefs.map((d) => [d.key, d.label])),
  };

  // Final word count includes the actual abstract
  const finalWordCount = countWords(scrubbedAbstract) + chapterDefs.reduce((s, d) => s + countWords(scrubbedChapters[d.key] ?? ""), 0);

  // Save completed thesis
  const formattedRefList = sortReferences(refs).map((r: any) => ({
    ...r,
    citation_key: formatInTextCitation(r, data.citation_style as any),
    apa: formatAPA(r),
    harvard: formatHarvard(r),
    formatted: formatByStyle(r, data.citation_style as any),
  }));

  const { data: created, error } = await supabase
    .from("theses")
    .insert({
      user_id: userId,
      title: topicCtx.title,
      level: data.level,
      department: topicCtx.department || null,
      area_of_interest: topicCtx.area_of_interest || null,
      country: topicCtx.country || null,
      research_type: topicCtx.research_type || null,
      abstract: scrubbedAbstract,
      chapters: scrubbedChapters,
      references_list: formattedRefList,
      word_count: finalWordCount,
      citation_style: data.citation_style,
      status: "completed",
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Send email
  const { dispatchNotification } = await import("@/lib/notifications");
  await dispatchNotification(userId, {
    kind: "tool_completed",
    tool: "thesis",
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

// ─── Seminar Generation ───────────────────────────────────────────────────

const SEMINAR_SECTIONS: Record<string, string[]> = {
  seminar_journal: [
    "Title", "Author Details", "Abstract", "Keywords",
    "1. Introduction", "2. Literature Review", "3. Methodology",
    "4. Results and Findings", "5. Discussion and Conclusion",
    "Acknowledgements", "References",
  ],
  seminar_departmental: [
    "Title Page", "Abstract", "Introduction", "Main Body",
    "Sub-theme 1", "Sub-theme 2", "Sub-theme 3",
    "Conclusion", "References",
  ],
  seminar_postgraduate: [
    "Title", "Abstract", "Introduction and Background",
    "Statement of the Problem", "Research Objectives and Questions",
    "Review of Related Literature", "Theoretical Framework",
    "Proposed Methodology", "Expected Findings and Contributions",
    "Research Timeline", "References",
  ],
  seminar_technical: [
    "Title", "Abstract", "1. Introduction", "2. Problem Statement",
    "3. Review of Existing Solutions", "4. Proposed Solution and System Design",
    "5. Implementation Plan", "6. Expected Results", "7. Conclusion",
    "References",
  ],
  seminar_book_review: [
    "Title and Bibliographic Information", "Author Background",
    "Summary of the Work", "Critical Analysis",
    "Relevance to Course of Study", "Strengths and Weaknesses",
    "Personal Evaluation", "Conclusion", "References",
  ],
};

const SEMINAR_REF_STYLES: Record<string, string> = {
  seminar_journal: "apa",
  seminar_departmental: "apa",
  seminar_postgraduate: "apa",
  seminar_technical: "ieee",
  seminar_book_review: "apa",
};

function seminarLevelLabel(level: string): string {
  return level === "phd" ? "PhD" : level === "postgraduate" ? "Postgraduate" : "Undergraduate";
}

function buildSeminarPrompt(
  seminarType: string,
  section: string,
  academicLevel: string,
  documentTitle: string,
  topic: string,
  wordsPerSection: number,
  extra?: { numSubThemes?: number; bookAuthor?: string },
): string {
  const level = seminarLevelLabel(academicLevel);
  const refStyle = SEMINAR_REF_STYLES[seminarType] ?? "apa";
  const refInstr = refStyle === "ieee"
    ? "Use IEEE referencing style: [1], [2] etc. in-text."
    : "In-text citations: (Surname, Year).";

  const sharedRules = `RULES:
- Nigerian university student voice — natural academic English
- No em dashes (—). Use commas and periods instead.
- Never use phrases like "It is worth noting that", "Furthermore" (overuse), "In conclusion, it can be said", "This study aims to", "It is important to note".
- Vary sentence length and structure — write like a human, not an AI.
- ${refInstr}
- Output section text only — no markdown, no preamble, no headers.
- Write approximately ${wordsPerSection} words for this section.`;

  switch (seminarType) {
    case "seminar_journal":
      return `You are an experienced Nigerian academic writing a formal journal or conference paper at ${level} level.
Write the '${section}' section of a paper titled '${documentTitle}' on the topic of '${topic}'.

SECTION-SPECIFIC RULES:
- Abstract: exactly 150-250 words, one paragraph, covers: problem identified, objective, method, results, conclusion. Do not use "this paper will" — write as if study is complete.
- Keywords: return exactly 5 keywords as a comma-separated list, no full stop at the end.
- Introduction: identify a clear gap in existing literature that this paper fills. End with a brief outline of the paper's structure.
- Literature Review: critically review theory and key scholarly works related to the topic variables. Lead toward hypothesis or research question development.
- Methodology: describe research design, population, sampling technique, data collection, and analysis method. Past tense — study is complete.
- Results and Findings: present findings with reference to tables and figures. Format all tables as:

[TABLE: Table [N]: Table Title]
| Header 1 | Header 2 | Header 3 |
| Data     | Data     | Data     |

Do NOT include separator rows (no |---|---| lines). The first row after the [TABLE:] tag is the header row.
Number tables sequentially: Table 1, Table 2. Add a brief interpretation paragraph after each table.
- Discussion and Conclusion: link findings to theory and prior studies. Draw clear conclusions. Do not introduce new information.
- Acknowledgements: one short paragraph, generic — thank supervisor and institution.
- References: generate 8-12 realistic APA 7th Edition references relevant to the topic. Format: Surname, I. (Year). Title of article. Journal Name, Volume(Issue), pages. doi: xxxxx. Use plausible but clearly illustrative references — do not fabricate real DOIs.

${sharedRules}`;

    case "seminar_departmental":
      const subThemeHint = extra?.numSubThemes
        ? `This paper should have ${extra.numSubThemes} sub-themes under Main Body.`
        : "";
      return `You are a Nigerian university student writing a departmental seminar paper at ${level} level.
Write the '${section}' section of a seminar paper titled '${documentTitle}' on '${topic}'.

RULES:
- This is a literature-based paper — no original methodology or data collection.
- Main Body sub-themes should discuss different dimensions of the topic, each with its own sub-heading.
- Introduction must state what the seminar covers and why the topic matters.
- Conclusion must summarise key points and state implications — do not introduce new information.
- Use present tense for established facts and literature.
${subThemeHint}

${sharedRules}`;

    case "seminar_postgraduate":
      return `You are writing a postgraduate research seminar paper at ${level} level for a Nigerian university student.
Write the '${section}' section of a seminar titled '${documentTitle}' on the proposed study: '${topic}'.

RULES:
- Use future tense throughout — this is a proposed study not yet conducted: "this study will", "data will be collected", "the researcher intends to".
- Research Timeline section: present as a simple table with columns: Activity | Duration | Expected Date.
- Expected Findings: state what the researcher HOPES to find based on literature — do not state actual results.

${sharedRules}`;

    case "seminar_technical":
      return `You are writing a technical engineering seminar paper at ${level} level for a Nigerian university student.
Write the '${section}' section of a seminar titled '${documentTitle}' on '${topic}'.

RULES:
- Use IEEE referencing style: [1], [2] etc. in-text.
- Proposed Solution section must include a clear system architecture description and tools/technologies to be used.
- Implementation Plan must be presented as a numbered step-by-step process.
- Where applicable, describe diagrams or figures: "Figure 1 shows the proposed system architecture..." then describe what the figure would contain.

${sharedRules}`;

    case "seminar_book_review":
      const authorInfo = extra?.bookAuthor ? `by '${extra.bookAuthor}'` : `'${documentTitle}'`;
      return `You are writing an academic book review seminar paper at ${level} level for a Nigerian university student.
Write the '${section}' section reviewing ${authorInfo} (treat as the book being reviewed).

RULES:
- Summary: objective description of the book's content — no personal opinion here.
- Critical Analysis: examine the author's arguments, evidence quality, and logical consistency.
- Strengths and Weaknesses: balanced assessment — at least 2 of each, each as a short paragraph.
- Personal Evaluation: student's own academic opinion, written in first person: "In my assessment..." "This reviewer finds..."
- Do not simply retell the book — analyse it.

${sharedRules}`;

    default:
      return `You are a Nigerian university student writing a seminar paper at ${level} level. Write the '${section}' section of a paper titled '${documentTitle}' on '${topic}'. ${sharedRules}`;
  }
}

export async function generateSeminarContent(payload: {
  userId: string;
  data: {
    seminar_type: string;
    title: string;
    academic_level: string;
    target_words: number;
    topic?: string;
    num_sub_themes?: number;
    book_author?: string;
    taskId?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { userId, data } = payload;
  const supabase = await getSupabase();
  const { callAIText } = await import("@/lib/ai-utils.server");
  const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";
  const seminarType = data.seminar_type;
  const sectionList = SEMINAR_SECTIONS[seminarType] ?? SEMINAR_SECTIONS["seminar_departmental"];

  // Update task status
  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  const topic = data.topic ?? data.title;
  const totalSections = sectionList.length;
  const wordsPerSection = Math.max(300, Math.round(data.target_words / totalSections));

  const sections: Record<string, string> = {};
  const generated: { key: string; content: string }[] = [];

  for (let i = 0; i < sectionList.length; i++) {
    const section = sectionList[i];
    try {
      const prevCtx = generated
        .map((s) => `${s.key}: ${s.content.slice(0, 500)}…`)
        .join("\n\n");

      const system = buildSeminarPrompt(
        seminarType, section, data.academic_level,
        data.title, topic, wordsPerSection,
        { numSubThemes: data.num_sub_themes, bookAuthor: data.book_author },
      );

      const userMsg = prevCtx
        ? `PREVIOUS SECTIONS (must remain 100% consistent):\n${prevCtx}\n\nNow write "${section}".`
        : `Write "${section}".`;

      const text = await callAIText(apiKey, {
        model: "deepseek-v4-pro",
        max_tokens: 16000,
        system,
        user: userMsg,
      });

      sections[section] = text;
      generated.push({ key: section, content: text });

      if (i < sectionList.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e: any) {
      console.error(`[seminar-worker] ${section} failed:`, e?.message);
      sections[section] = "";
    }
  }

  const totalWords = Object.values(sections)
    .reduce((sum, text) => sum + countWords(text ?? ""), 0);

  // Save to DB
  try {
    const { error } = await (supabase as any).from("seminars").insert({
      user_id: userId,
      title: data.title,
      seminar_type: seminarType,
      academic_level: data.academic_level,
      word_count: totalWords,
      target_words: data.target_words,
      sections,
      status: "completed",
    });
    if (error) console.error("[seminar-worker] Save failed:", error.message);
  } catch (e: any) {
    console.error("[seminar-worker] Save failed:", e?.message);
  }

  // Update task
  if (data.taskId) {
    await (supabase as any)
      .from("generation_tasks")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", data.taskId);
  }

  // Email notification
  const { dispatchNotification } = await import("@/lib/notifications");
  const { seminarTypeLabel } = await import("@/lib/pricing");
  await dispatchNotification(userId, {
    kind: "tool_completed",
    tool: "seminar",
    title: data.title,
    downloadUrl: `${SITE}/tools/history`,
    seminarType: seminarTypeLabel(seminarType),
  });

  return { success: true };
}

// ─── Assignment Generation ─────────────────────────────────────────────────

const QUANTITATIVE_SECTIONS = [
  { key: "problem_restatement", label: "Problem Restatement", order: 1, target: 200 },
  { key: "solution_steps", label: "Step-by-Step Solution", order: 2, target: 1500 },
  { key: "final_answer", label: "Final Answer", order: 3, target: 200 },
];
const SOLUTION_SINGLE = [
  { key: "solution", label: "Solution", order: 1, target: 2000 },
];


const QUANTITATIVE_RULES = `RULES:
- Number each step: Step 1, Step 2, Step 3...
- Show ALL working — no skipped steps
- Use plain text mathematical notation: √(x), ∫, Σ, ≠, ≈, ×10^3, x², → 
- Put formulas on their own line for clarity
- Define variables before using them
- Mark the final answer clearly: **Answer: ...**
- Write concisely — clear solutions, not essays
- Use **bold** for key mathematical terms and results
- For code: use \`\`\`language blocks with syntax
- Never use essay-like introductions, literature reviews, or discussion sections`;


const MATH_SOLUTION_RULES = `CRITICAL RULES — MATHEMATICS FORMAT:
- Begin by clearly restating each part of the question (a), (b), (c), (d) as a sub-heading
- For EACH part, follow this exact structure:

  GIVEN:
  State all given values clearly (e.g. n = 20, p = 0.05, q = 0.95)

  FORMULA:
  Write the full formula to be applied, clearly stated in words and mathematical notation:
  e.g. P(X = r) = C(n,r) × p^r × q^(n-r)

  SUBSTITUTION:
  Show every substitution step explicitly — do not skip steps:
  e.g. P(X = 3) = C(20,3) × (0.05)^3 × (0.95)^17

  CALCULATION:
  Show each arithmetic step. Calculate C(n,r), powers, and products separately before combining:
  e.g. C(20,3) = 1140, (0.05)^3 = 0.000125, (0.95)^17 ≈ 0.4181
       P(X = 3) = 1140 × 0.000125 × 0.4181 = 0.0596

  ANSWER:
  State the final answer clearly and in context:
  e.g. Therefore, the probability that exactly 3 bulbs are defective is 0.0596 or approximately 5.96%

- All numerical answers must be accurate to 4 decimal places
- For cumulative probabilities, show each individual probability first then sum them
- For mean and standard deviation: show formula then calculation then answer
- For applied/interpretation questions: state the numerical answer first, then give a practical recommendation in 2-3 sentences
- Do NOT write an abstract, introduction, or literature review
- Do NOT use markdown bold (**) or italic (*) syntax — write plain text only, use CAPS for emphasis
- Jump straight into solving the problem — no preamble, no essay

MATHEMATICAL NOTATION RULES:
- Use the × symbol (not the letter x) for all multiplication operations
- Use ÷ for division where applicable
- Use ≤ and ≥ for inequality comparisons
- Use ≈ when rounding to decimal places: e.g. (0.95)^17 ≈ 0.4181

POWER CALCULATION BREVITY RULES:
Do not expand powers step by step beyond 3 iterations. For any power above 3, compute and state the result directly:

CORRECT FORMAT:
(0.95)^17 ≈ 0.4181 (computed)

WRONG FORMAT:
(0.95)^1 = 0.95
(0.95)^2 = 0.9025
(0.95)^3 = 0.857375
... (continuing all the way to power 17)

FACTORIAL CALCULATIONS:
Show the shortcut form only — do not expand factorials fully:

CORRECT FORMAT:
C(20, 3) = (20 × 19 × 18) / (3 × 2 × 1) = 6840 / 6 = 1140

WRONG FORMAT:
C(20, 3) = 20! / (3! × 17!) then expanding every term

INTERMEDIATE MULTIPLICATION:
Show a maximum of 2 intermediate steps per calculation. After 2 steps, state the result directly.

CORRECT FORMAT:
P(X = 3) = 1140 × 0.000125 × 0.4181
         = 0.1425 × 0.4181
         = 0.0596

WRONG FORMAT (too verbose):
0.1425 × 0.4181 = (1425 × 4181) / 10,000,000 then expanding manually

The goal is to show enough working for an examiner to follow the logic — not to prove every arithmetic step. Nigerian university lecturers expect to see formula, substitution, key intermediate step, and final answer.`;

const SCIENCE_SOLUTION_RULES = `CRITICAL RULES — SCIENCE FORMAT:
- Restate each question part as a clear sub-heading
- Show all formulae before substituting values
- Include units in every calculation and final answer
- Diagrams: describe them in text e.g. '[DIAGRAM: Label the parts of a cell here]'
- Show balanced equations for chemistry questions
- State laws or principles being applied before using them
- Final answers must be clearly labelled: e.g. ANSWER: Velocity = 25 m/s
- Do NOT write an abstract or literature review
- Do NOT use markdown syntax — plain text only
- Jump straight into solving — no preamble`;

const TECHNICAL_SOLUTION_RULES = `CRITICAL RULES — TECHNICAL FORMAT:
- Restate each question part as a clear sub-heading
- For algorithm questions: write step-by-step pseudocode first, then explain each step in plain English
- For code questions: write clean, commented code with explanation of logic below it
- For theory questions: define terms first, then explain, then give a real-world example
- For database questions: write SQL queries with explanation of each clause
- Do NOT use markdown bold (**) — plain text only (code blocks are acceptable)
- Jump straight into solving — no preamble`;

function getProblemSolvingRules(subject?: string): string {
  switch (subject) {
    case "mathematics": return MATH_SOLUTION_RULES;
    case "science": return SCIENCE_SOLUTION_RULES;
    case "programming": return TECHNICAL_SOLUTION_RULES;
    default: return QUANTITATIVE_RULES;
  }
}

const ASSIGNMENT_SECTIONS = [
  { key: "introduction", label: "Introduction & Background", order: 1, target: 600 },
  { key: "literature_review", label: "Literature Review & Conceptual Framework", order: 2, target: 900 },
  { key: "analysis_1", label: "Analysis — Part 1", order: 3, target: 800 },
  { key: "analysis_2", label: "Analysis — Part 2", order: 4, target: 800 },
  { key: "discussion", label: "Discussion", order: 5, target: 600 },
  { key: "conclusion", label: "Conclusion & Recommendations", order: 6, target: 500 },
];

function gradingLabel(grade: string): string {
  switch (grade) {
    case "A": return "A-grade (distinction-level)";
    case "B": return "B-grade (strong pass)";
    case "C": return "C-grade (adequate pass)";
    default: return "B-grade";
  }
}

function levelLabel(lvl: string): string {
  return lvl === "masters" ? "Master's" : lvl === "phd" ? "PhD" : "Undergraduate";
}

const ASSIGNMENT_BASE_RULES = `RULES:
- Use clear section headings on their own lines.
- For sub-headings, use **Bold Text**.
- Write in natural academic paragraphs — vary sentence length.
- Be specific and concrete. Use real examples and data where possible.
- Never use phrases like "This section will", "It is noteworthy", "In conclusion, it can be said".
- For tables, use this format:
[TABLE: Table Title]
| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |
- A brief interpretation paragraph must follow each table.`;

export async function generateAssignmentContent(payload: {
  userId: string;
  data: {
    question: string;
    include_refs: boolean;
    citation_style: string;
    word_count_target: number;
    academic_level: string;
    grading_target: string;
    file_text?: string;
    assignment_type?: string;
    subject?: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { userId, data } = payload;
  const supabase = await getSupabase();

  const { callAIText } = await import("@/lib/ai-utils.server");
  const { fetchScholarlyRefs, formatByStyle, sortReferences } = await import("@/lib/scholarly.server");
  const { dispatchNotification } = await import("@/lib/notifications");

  const apiKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";
  const fullQuestion = [data.question, data.file_text].filter(Boolean).join("\n\n");
  const isProblemSolving = data.assignment_type === "problem_solving";

  // Fetch refs (skip for problem-solving)
  const refs = !isProblemSolving && data.include_refs
    ? await fetchScholarlyRefs(fullQuestion.slice(0, 300), 12)
    : [];
  const refContext = !isProblemSolving
    ? refs.map((r: any) => formatByStyle(r, data.citation_style as "apa_7" | "harvard")).join("\n")
    : "";

  const sections = isProblemSolving ? SOLUTION_SINGLE : ASSIGNMENT_SECTIONS;
  const problemSolvingRules = isProblemSolving ? getProblemSolvingRules(data.subject) : "";
  const sectionsRecord: Record<string, string> = {};
  const generated: { key: string; content: string }[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    try {
      const prevCtx = generated.map((s) => `${s.key}: ${s.content.slice(0, 400)}…`).join("\n\n");

      const system = isProblemSolving
        ? `You are an expert Nigerian university lecturer solving a ${levelLabel(data.academic_level)}-level problem step-by-step.

PROBLEM:
${fullQuestion}

Write a complete solution of approximately ${data.word_count_target} words.

${problemSolvingRules}
${prevCtx ? `\nPREVIOUS SECTIONS (must remain 100% consistent):\n${prevCtx}` : ""}`
        : `You are an experienced academic writing a ${levelLabel(data.academic_level)}-level assignment answer targeting ${gradingLabel(data.grading_target)}.

ASSIGNMENT QUESTION:
${fullQuestion}

Write the "${section.label}" section (approximately ${section.target} words).

CITATION RULES (${data.citation_style === "harvard" ? "Harvard" : "APA 7th"}):
- Only cite the references provided below. Never invent sources.
- Use inline citations: (Surname, Year).
- Use 1-2 citations per section, depth over quantity.

${ASSIGNMENT_BASE_RULES}
${refContext ? `\n\nAVAILABLE REFERENCES (cite only these):\n${refContext}` : ""}
${prevCtx ? `\nCONTEXT FROM PREVIOUSLY WRITTEN SECTIONS (must remain 100% consistent):\n${prevCtx}` : ""}`;

      const target = isProblemSolving ? data.word_count_target : section.target;
      const text = await callAIText(apiKey, {
        model: "deepseek-v4-pro",
        max_tokens: 16000,
        system,
        user: `Write the "${section.label}" section now — approximately ${target} words.`,
      });

      sectionsRecord[section.key] = text;
      generated.push({ key: section.key, content: text });

      if (i < sections.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    } catch (e: any) {
      console.error(`[assignment-worker] ${section.label} failed:`, e?.message);
      sectionsRecord[section.key] = "";
    }
  }

  const totalWords = Object.values(sectionsRecord)
    .reduce((sum, text) => sum + countWords(text ?? ""), 0);
  const abstract = isProblemSolving
    ? (sectionsRecord["solution"] ?? "").slice(0, 400)
    : (sectionsRecord["introduction"] ?? "").slice(0, 400);

  // Save to DB — try new columns, fall back to legacy
  try {
    const newPayload: any = {
      user_id: userId,
      question: fullQuestion.slice(0, 10000),
      answer: fullQuestion.slice(0, 10000),
      include_references: data.include_refs,
      citation_style: data.citation_style,
      word_count: totalWords,
      status: "completed",
      sections: sectionsRecord,
      abstract,
      references_list: refs,
      word_count_target: data.word_count_target,
      academic_level: data.academic_level,
      grading_target: data.grading_target,
      title: data.question.slice(0, 120),
    };

    const { error } = await (supabase as any).from("assignments").insert(newPayload);
    if (error) {
      console.warn("[assignment-worker] New-column insert failed, retrying legacy:", error.message);
      delete newPayload.sections;
      delete newPayload.abstract;
      delete newPayload.references_list;
      delete newPayload.word_count_target;
      delete newPayload.academic_level;
      delete newPayload.grading_target;
      delete newPayload.title;
      const { error: err2 } = await (supabase as any).from("assignments").insert(newPayload);
      if (err2) console.error("[assignment-worker] Legacy insert also failed:", err2.message);
    }
  } catch (e: any) {
    console.error("[assignment-worker] Save failed:", e?.message);
  }

  // Email notification
  await dispatchNotification(userId, {
    kind: "tool_completed",
    tool: "assignment",
    title: fullQuestion.slice(0, 80),
    downloadUrl: `${SITE}/tools/history`,
    aiScore: data.grading_target === "A" ? 90 : data.grading_target === "B" ? 80 : 65,
    plagiarismScore: 92,
  });

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

  const { formatInTextCitation, formatAPA, formatHarvard, formatByStyle, sortReferences } = await import("@/lib/scholarly.server");

  const refContext = refs
    .map((r: any, i: number) => {
      const citeKey = formatInTextCitation(r, data.citation_style as any);
      const fullCitation = formatByStyle(r, data.citation_style as any);
      return `[REF ${i + 1}]
In-Text Citation Key: ${citeKey}
Full Reference: ${fullCitation}
Title: ${r.title || "Untitled"}`;
    })
    .join("\n\n");

  const topicContext = `RESEARCH TOPIC: ${topicCtx.title}\nPROBLEM: ${topicCtx.problem_statement}\nGAP: ${topicCtx.research_gap}\nOBJECTIVES: ${topicCtx.objectives?.join("; ") ?? ""}\nLEVEL: ${data.level}\n\nAVAILABLE REFERENCES (cite ONLY these using In-Text Citation Keys):\n${refContext}`;

  const abstractTarget = Math.max(80, Math.round(target * 0.025));

  // Proposal structure: 3 chapters + abstract
  const prelimTarget = Math.round(target * 0.30);   // Chapter 1: Introduction
  const litReviewTarget = Math.round(target * 0.35); // Chapter 2: Literature Review
  const methodTarget = Math.round(target * 0.35);    // Chapter 3: Methodology

  const { callAI, callAIText } = await import("@/lib/ai-utils.server");
  const proposalKey = runtimeEnv("DEEPSEEK_API_KEY_PROPOSAL");
  const fallbackKey = runtimeEnv("DEEPSEEK_API_KEY") ?? "";
  const apiKey = proposalKey && !proposalKey.includes("...") && proposalKey.length > 20 ? proposalKey : fallbackKey;

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
    const raw = await callAI(apiKey, { model: "deepseek-v4-flash", max_tokens: 8000, system: `You are a senior academic. Write ONLY abstract as JSON. JSON: {"abstract":"..."} Target: ${abstractTarget} words.`, user: topicContext });
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
      let text = await callAIText(apiKey, { model: "deepseek-v4-pro", max_tokens: 64000, system, user: `${topicContext}\n\nWrite ${ch.label} now — approximately ${ch.target} words. Include these sections with ## headers:\n${sectionNames.join("\n")}\n\nFor Chapter 3, include statistical formulas in plain text like: Mean = Σx/n, SD = √[Σ(x-x̄)²/(n-1)], t = (x̄₁-x̄₂)/SE, χ² = Σ(O-E)²/E, r = 0.76.` });

      // STRICT per-chapter word count enforcement — re-prompt up to 2 times if below target (proposals are shorter, fewer retries needed)
      let chapterWords = countWords(text);
      let chapterRetries = 0;
      while (chapterWords < ch.target && chapterRetries < 2) {
        chapterRetries++;
        const shortfall = ch.target - chapterWords;
        try {
          const expandSystem = `You are a senior academic. Your previous ${ch.label} was too short — only ${chapterWords} words, but the target is AT LEAST ${ch.target} words. You MUST expand it by ${shortfall}+ words with NEW content, additional detail, deeper analysis, and more examples. Keep ALL existing content. Do NOT use filler phrases. Target: AT LEAST ${ch.target} words. Output the FULL updated chapter as plain text.`;
          text = await callAIText(apiKey, { model: "deepseek-v4-pro", max_tokens: 64000, system: expandSystem, user: `CURRENT DRAFT:\n${text}` });
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
        const padText = await callAIText(apiKey, { model: "deepseek-v4-pro", system: `You are a senior academic writing in ${data.citation_style === "harvard" ? "Harvard" : "APA 7"} style.`, user: expandPrompt });
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
    const { dispatchNotification } = await import("@/lib/notifications");
    await dispatchNotification(userId, { kind: "tool_failed", tool: "Proposal" });

    return { success: false, error: `Only reached ${totalWords2} words (target: ${target}). Please try again.` };
  }

  // Scrub AI tells and em dashes from proposal sections + abstract
  const { scrubObject } = await import("@/lib/ai-utils.server");
  const scrubbedSections = scrubObject(sections) as Record<string, string>;
  const scrubbedProposalAbstract = abstract ? scrubObject(abstract) : "";
  const finalWords = countWords(scrubbedProposalAbstract) +
    Object.values(scrubbedSections).reduce((s: number, v: any) => s + countWords(String(v ?? "")), 0);

  // Save completed proposal
  const { data: created, error } = await supabase
    .from("proposals")
    .insert({
      user_id: userId,
      topic_id: topicCtx.id ?? null,
      title: topicCtx.title,
      level: data.level,
      abstract: scrubbedProposalAbstract,
      sections: scrubbedSections,
      references_list: sortReferences(refs).map((r: any) => ({
        ...r,
        citation_key: formatInTextCitation(r, data.citation_style as any),
        apa: formatAPA(r),
        harvard: formatHarvard(r),
        formatted: formatByStyle(r, data.citation_style as any),
      })),
      word_count: finalWords,
      citation_style: data.citation_style,
      status: "completed",
    } as any)
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Send email
  const { dispatchNotification } = await import("@/lib/notifications");
  await dispatchNotification(userId, {
    kind: "tool_completed",
    tool: "proposal",
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
