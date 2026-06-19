// Shared AI helpers: DeepSeek tool-call, AI-tell scrubbing, word counting/trimming.

const AI_TELLS: RegExp[] = [
  /\bin today'?s (?:fast-paced|rapidly evolving|modern|digital) world\b/gi,
  /\bdelv(?:e|ing) into\b/gi,
  /\bnavigat(?:e|ing) the (?:complex )?landscape\b/gi,
  /\bit (?:is|'s) (?:important|crucial|essential) to note that\b/gi,
  /\bin conclusion,?\s*/gi,
  /\bin summary,?\s*/gi,
  /\bfurthermore,? it (?:is|should be) (?:worth )?noting that\b/gi,
  /\bplays? a (?:pivotal|crucial|vital|significant) role\b/gi,
  /\ba testament to\b/gi,
  /\bin the realm of\b/gi,
  /\bever-(?:evolving|changing|growing)\b/gi,
  /\bunlock (?:the )?(?:potential|power) of\b/gi,
  /\bharness(?:ing)? the power of\b/gi,
  /\btapestry of\b/gi,
  /\bmyriad of\b/gi,
  /\bat the end of the day\b/gi,
  /\bwhen all is said and done\b/gi,
  /\bit goes without saying that\b/gi,
  /\bneedless to say,?\s*/gi,
  /\bas (?:we|one) can see,?\s*/gi,
  /\bin the world of\b/gi,
  /\bgame-?changer\b/gi,
  /\bcutting[- ]edge\b/gi,
  /\bstate[- ]of[- ]the[- ]art\b/gi,
  /\bparadigm shift\b/gi,
  /\bdive deep(?:er)? into\b/gi,
  /\bunderscores? the importance of\b/gi,
];

export function stripMarkdown(input: string): string {
  let out = input;
  // Bold/italic markers — keep inner text
  out = out.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1");
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1$2");
  out = out.replace(/___([^_\n]+?)___/g, "$1");
  out = out.replace(/__([^_\n]+?)__/g, "$1");
  out = out.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2");
  // Inline code & strikethrough
  out = out.replace(/`([^`\n]+?)`/g, "$1");
  out = out.replace(/~~([^~\n]+?)~~/g, "$1");
  // Markdown headings (#, ##, ###) — convert to plain heading lines
  out = out.replace(/^#{1,6}\s+/gm, "");
  // Markdown bullet markers at line start
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
  // Stray leftover asterisks
  out = out.replace(/\*+/g, "");
  return out;
}

export function scrubAITells(input: string): string {
  let out = stripMarkdown(input);
  for (const re of AI_TELLS) out = out.replace(re, "");
  return out
    .replace(/—{2,}/g, "—")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function scrubObject<T>(v: T): T {
  if (typeof v === "string") return scrubAITells(v) as any;
  if (Array.isArray(v)) return v.map((x) => scrubObject(x)) as any;
  if (v && typeof v === "object") {
    const out: any = {};
    for (const [k, val] of Object.entries(v)) out[k] = scrubObject(val);
    return out;
  }
  return v;
}

export function countWords(text: string): number {
  const t = (text ?? "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

export function countWordsDeep(v: unknown): number {
  if (typeof v === "string") return countWords(v);
  if (Array.isArray(v)) return v.reduce<number>((a, x) => a + countWordsDeep(x), 0);
  if (v && typeof v === "object")
    return Object.values(v as Record<string, unknown>).reduce<number>(
      (a, x) => a + countWordsDeep(x),
      0,
    );
  return 0;
}

export function trimToExactWords(text: string, n: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= n) return text.trim();
  const kept = words.slice(0, n).join(" ");
  // close with a period if cleanly possible
  return /[.!?]$/.test(kept) ? kept : kept.replace(/[,;:]$/, "") + ".";
}

export async function callAI(
  apiKey: string,
  opts: {
    model: string;
    system: string;
    user: string;
    max_tokens?: number;
  },
): Promise<any> {
  const body: Record<string, any> = {
    model: opts.model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
  };
  if (opts.max_tokens) body.max_tokens = opts.max_tokens;
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`DeepSeek API error ${resp.status}: ${text}`);
  }
  const payload = await resp.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Did not receive a response.");
  // Strip markdown fences if present
  const json = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  return JSON.parse(json);
}

/**
 * Like callAI but without response_format: json_object.
 * Returns the raw text content. Use for long-form prose where
 * embedding the text inside a JSON string value would risk
 * unescaped characters.
 */
export async function callAIText(
  apiKey: string,
  opts: {
    model: string;
    system: string;
    user: string;
  },
): Promise<string> {
  const resp = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: opts.model,
      messages: [
        { role: "system", content: opts.system },
        { role: "user", content: opts.user },
      ],
    }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    if (resp.status === 429) throw new Error("Rate limit exceeded. Please try again shortly.");
    throw new Error(`DeepSeek API error ${resp.status}: ${text}`);
  }
  const payload = await resp.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Did not receive a response.");
  return content.trim();
}
