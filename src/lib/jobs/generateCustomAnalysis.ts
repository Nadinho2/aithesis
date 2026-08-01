/**
 * Assessment tool: single-call AI analysis using student-defined fields.
 *
 * Calls the DeepSeek API directly with a custom system prompt that bakes
 * humanization rules into the generation itself — no separate humanize step
 * needed since this is a single short generation, not a multi-chapter pipeline.
 */

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface AnalysisResult {
  success: boolean;
  results?: { name: string; answer: string }[];
  error?: string;
}

// ─── System prompt builder ─────────────────────────────────────────────────

function buildSystemPrompt(scenarioText: string, fields: string[]): string {
  return `A student has submitted a scenario and wants it analyzed using their own custom framework. Answer each field they've defined, based on genuine analysis of their scenario, not generic filler.

SCENARIO: '${scenarioText}'

RESPOND TO EXACTLY THESE FIELDS, IN THIS ORDER:
${fields.join(", ")}

RULES:
- Each field's answer must specifically address what that field name is asking. Infer the intent from the label itself.
- Keep each answer concise and precise, 1-3 sentences per field unless the field clearly calls for more detail (e.g. 'Explanation' vs 'Level').
- Write like a sharp, experienced person giving a real assessment, not a textbook or a template.

BANNED PATTERNS — never use any of the following:
- Em dashes (—) in any form. Replace with commas, full stops, or restructure the sentence entirely.
- 'It is worth noting that' or 'It should be noted that'
- Identical sentence structure repeated across different fields — vary how each answer opens and flows
- Overly formal, robotic scoring language ('Score: X', 'Assessment: Pass/Fail') unless the field name itself literally asks for a score or rating
- Generic filler that could apply to any scenario — every answer must clearly reference specifics from THIS scenario

REQUIRED PATTERNS:
- Mix short, direct answers with slightly longer reasoned ones depending on what each field actually needs
- Sound like a real person who read this specific scenario carefully, not a template being filled in

OUTPUT FORMAT: Return a JSON array only, no markdown, no preamble:
[
  { "name": "Statement Type", "answer": "..." },
  { "name": "Urgency Level", "answer": "..." }
]`;
}

// ─── Parse DeepSeek response ───────────────────────────────────────────────

function parseDeepSeekJSON(content: string): { name: string; answer: string }[] | null {
  try {
    let cleaned = content.trim();
    // Strip markdown fences if present
    cleaned = cleaned.replace(/^```(?:json)?\s*|\s*```$/g, "").trim();
    // Find JSON array
    const start = cleaned.indexOf("[");
    if (start === -1) return null;
    const end = cleaned.lastIndexOf("]");
    if (end === -1 || end <= start) return null;
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    // Validate shape
    for (const item of parsed) {
      if (!item.name || typeof item.name !== "string") return null;
      if (typeof item.answer !== "string") return null;
    }
    return parsed as { name: string; answer: string }[];
  } catch {
    return null;
  }
}

// ─── Main export ───────────────────────────────────────────────────────────

export async function generateCustomAnalysis({
  scenarioText,
  fields,
}: {
  scenarioText: string;
  fields: string[];
}): Promise<AnalysisResult> {
  const apiKey = runtimeEnv("DEEPSEEK_API_KEY");
  if (!apiKey) {
    return { success: false, error: "AI service not configured." };
  }

  const systemPrompt = buildSystemPrompt(scenarioText, fields);

  // First attempt
  try {
    const resp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        temperature: 0.7,
        max_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Generate the analysis now." },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[generateCustomAnalysis] DeepSeek API error:", resp.status, errText);
      return { success: false, error: "AI service error. Please try again." };
    }

    const payload = await resp.json();
    let content = payload?.choices?.[0]?.message?.content;

    // V4 model defaults to thinking ON — fallback to reasoning_content
    if (!content || content.trim().length === 0) {
      content = payload?.choices?.[0]?.message?.reasoning_content;
    }

    if (!content || content.trim().length === 0) {
      console.error("[generateCustomAnalysis] Empty response:", JSON.stringify(payload).slice(0, 500));
      return { success: false, error: "Could not generate analysis. Please try again." };
    }

    const parsed = parseDeepSeekJSON(content);
    if (parsed) {
      return { success: true, results: parsed };
    }

    // Retry with explicit JSON instruction
    console.error("[generateCustomAnalysis] JSON parse failed, retrying...");

    await new Promise((r) => setTimeout(r, 1000));

    const retryResp = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "deepseek-v4-pro",
        temperature: 0.5,
        max_tokens: 8000,
        messages: [
          { role: "system", content: systemPrompt + "\n\nCRITICAL: Return valid JSON only, no other text. No markdown, no preamble, no explanation — just the JSON array." },
          { role: "user", content: "Return ONLY a JSON array. No other text." },
        ],
      }),
    });

    if (!retryResp.ok) {
      const errText = await retryResp.text();
      console.error("[generateCustomAnalysis] Retry API error:", retryResp.status, errText);
      return { success: false, error: "Could not generate analysis. Please try again." };
    }

    const retryPayload = await retryResp.json();
    let retryContent = retryPayload?.choices?.[0]?.message?.content;
    if (!retryContent || retryContent.trim().length === 0) {
      retryContent = retryPayload?.choices?.[0]?.message?.reasoning_content;
    }

    if (!retryContent || retryContent.trim().length === 0) {
      return { success: false, error: "Could not generate analysis. Please try again." };
    }

    const retryParsed = parseDeepSeekJSON(retryContent);
    if (retryParsed) {
      return { success: true, results: retryParsed };
    }

    return { success: false, error: "Could not generate analysis. Please try again." };
  } catch (e: any) {
    console.error("[generateCustomAnalysis] Unexpected error:", e?.message ?? e);
    return { success: false, error: "Could not generate analysis. Please try again." };
  }
}
