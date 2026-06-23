/**
 * Shared AI helpers: unified provider calls, AI-tell scrubbing, word counting/trimming.
 *
 * callAI()   → returns a parsed JSON object (for structured data generation).
 * callAIText() → returns raw text (for long-form prose generation).
 *
 * Both support DeepSeek and Gemini models transparently via ai-provider.ts.
 */

import { callProvider, extractJSON, stripReasoningTags } from "./ai-provider";

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
  out = out.replace(/\*\*\*([^*\n]+?)\*\*\*/g, "$1");
  out = out.replace(/\*\*([^*\n]+?)\*\*/g, "$1");
  out = out.replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1$2");
  out = out.replace(/___([^_\n]+?)___/g, "$1");
  out = out.replace(/__([^_\n]+?)__/g, "$1");
  out = out.replace(/(^|[^_])_([^_\n]+?)_(?!_)/g, "$1$2");
  out = out.replace(/`([^`\n]+?)`/g, "$1");
  out = out.replace(/~~([^~\n]+?)~~/g, "$1");
  out = out.replace(/^#{1,6}\s+/gm, "");
  out = out.replace(/^\s*[-*+]\s+/gm, "• ");
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
  return /[.!?]$/.test(kept) ? kept : kept.replace(/[,;:]$/, "") + ".";
}

/**
 * Call any supported AI model and return a parsed JSON object.
 *
 * Works with:
 *   deepseek-chat / deepseek-reasoner (via DeepSeek API)
 *   gemini-2.5-flash / gemini-2.5-pro (via Gemini API)
 *
 * @param apiKey - Provider API key. Optional for Gemini (reads GEMINI_API_KEY env).
 * @param opts.model - Model name (e.g. "deepseek-chat", "gemini-2.5-flash")
 * @param opts.system - System prompt
 * @param opts.user - User prompt
 * @param opts.max_tokens - Max output tokens (optional)
 */
export async function callAI(
  apiKey: string,
  opts: {
    model: string;
    system: string;
    user: string;
    max_tokens?: number;
  },
): Promise<any> {
  const result = await callProvider(apiKey, { ...opts, jsonMode: true });
  return extractJSON(result.content);
}

/**
 * Call any supported AI model and return raw text content.
 *
 * Works with:
 *   deepseek-chat / deepseek-reasoner (via DeepSeek API)
 *   gemini-2.5-flash / gemini-2.5-pro (via Gemini API)
 *
 * Useful for long-form prose where embedding text inside JSON would risk
 * unescaped characters.
 *
 * @param apiKey - Provider API key. Optional for Gemini (reads GEMINI_API_KEY env).
 * @param opts.model - Model name
 * @param opts.system - System prompt
 * @param opts.user - User prompt
 */
export async function callAIText(
  apiKey: string,
  opts: {
    model: string;
    system: string;
    user: string;
    max_tokens?: number;
  },
): Promise<string> {
  const result = await callProvider(apiKey, opts);
  let content = result.content;
  if (result.isReasoner) {
    content = stripReasoningTags(content);
  }
  return content.trim();
}
