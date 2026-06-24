import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { callAIText } from "./ai-utils.server";
import { z } from "zod";

const BASE_HUMANIZE_PROMPT = `You are rewriting academic text to make it indistinguishable from text written by a Nigerian university student. You must preserve every fact, citation, argument, and sub-section structure exactly.

BANNED PATTERNS — never use any of the following:
- Em dashes (—) in any form. Replace with commas, full stops, or restructure the sentence entirely
- 'Not only... but also' sentence constructions
- 'It is worth noting that' or 'It should be noted that'
- 'Moreover,' 'Furthermore,' 'Additionally,' appearing more than once per paragraph — vary with: 'Also,' 'Beyond this,' 'At the same time,' 'In the same vein,' 'Relatedly,' or restructure so no transition word is needed
- Perfectly uniform paragraph lengths — vary between 3 and 7 sentences per paragraph deliberately
- Summary sentences at the end of sections that restate what was just said (e.g. 'In summary, this section has shown...') — cut these entirely
- Consecutive sentences of similar length — after a long sentence, write a short one. Break rhythm deliberately
- Overly formal openers like 'The foregoing analysis suggests...' or 'From the above, it is evident that...'
- Repetition of the section title in the opening sentence
- Semicolons used to join two independent clauses in an overly balanced way
- Triplet lists: 'clarity, coherence, and consistency' style constructions used repeatedly

REQUIRED PATTERNS — apply these:
- Mix short sentences (under 12 words) and long sentences (over 25 words) within every paragraph
- Occasionally begin a sentence with 'This' referring to the previous idea: 'This gap...' 'This relationship...'
- Use hedging language naturally: 'suggests', 'appears to', 'tends to', 'in many cases', 'often'
- Use first-person academic voice where appropriate: 'this study argues', 'this chapter examines', 'the researcher notes'
- Vary citation placement — sometimes mid-sentence, sometimes at the end, sometimes at the start of a claim
- Use Nigerian academic phrasing where natural: 'in the Nigerian context', 'within the Nigerian educational system', 'as obtained in developing economies'
- Occasionally use a rhetorical question to open a paragraph, then immediately answer it in the same paragraph

OUTPUT: return only the rewritten text. No explanation. No preamble. No markdown.`;

const SYSTEM_PROMPTS: Record<string, string> = {
  light: BASE_HUMANIZE_PROMPT + "\n\nApply subtle improvements only — fix all em dashes, reduce consecutive similar-length sentences, and remove summary restatements. Do not restructure extensively.",

  medium: BASE_HUMANIZE_PROMPT,

  aggressive: BASE_HUMANIZE_PROMPT + "\n\nAdditionally: restructure at least 3 paragraph openings so they do not begin with a noun phrase. Start some with a dependent clause, some with a short adverbial, some with a direct statement of finding. This text has already been flagged by an AI detector — maximum variation is required while keeping all academic content 100% intact.",
};

const HumanizeInputSchema = z.object({
  text: z.string().min(1, "Text is required"),
  sectionTitle: z.string().optional(),
  intensity: z.enum(["light", "medium", "aggressive"]).optional().default("medium"),
});

async function callDeepSeekWithRetry(
  apiKey: string,
  system: string,
  user: string,
): Promise<string> {
  try {
    return await callAIText(apiKey, {
      model: "deepseek-reasoner",
      system,
      user,
    });
  } catch (e: any) {
    // Retry once on rate limit
    if (e?.message?.includes("Rate limit") || e?.message?.includes("429")) {
      await new Promise((r) => setTimeout(r, 1000));
      return await callAIText(apiKey, {
        model: "deepseek-reasoner",
        system,
        user,
      });
    }
    throw e;
  }
}

export const humanizeText = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((input: unknown) => HumanizeInputSchema.parse(input))
  .handler(async ({ data, context }) => {
    try {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) {
        return { success: false as const, error: "DeepSeek is not configured." };
      }

      // Clean the input — remove extremely long contiguous blocks that may cause issues
      const wordCount = data.text.trim().split(/\s+/).length;
      if (wordCount > 6000) {
        return {
          success: false as const,
          error: `Text exceeds 6,000 words (${wordCount} words). Process your thesis section by section.`,
        };
      }

      const system = SYSTEM_PROMPTS[data.intensity ?? "medium"];
      const userMessage = data.sectionTitle
        ? `Section: ${data.sectionTitle}\n\n${data.text}`
        : data.text;

      const humanizedText = await callDeepSeekWithRetry(apiKey, system, userMessage);

      return { success: true as const, humanizedText };
    } catch (e: any) {
      const msg = e?.message ?? "Unknown error";
      if (msg.includes("429") || msg.includes("Rate limit")) {
        return { success: false as const, error: "Rate limit exceeded. Please try again shortly." };
      }
      console.error("humanizeText error:", e);
      return { success: false as const, error: msg };
    }
  });
