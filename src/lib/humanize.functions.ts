import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { callAIText } from "./ai-utils.server";
import { z } from "zod";

const SYSTEM_PROMPTS: Record<string, string> = {
  light:
    "You are an academic editor. Rewrite the following thesis text to read as naturally human-written. " +
    "Make subtle structural variations to sentence length and openers while preserving 100% of the factual content, " +
    "citations, technical terms, and meaning. Use natural academic transitions. " +
    "Do not use contractions or informal language. Do not add new claims, remove content, or alter citations. " +
    "Do not include any preamble, explanation, or markdown — output only the rewritten text.",

  medium:
    "You are an academic editor. Rewrite the following thesis text so it reads as naturally human-written, " +
    "while preserving 100% of the factual content, citations, technical terms, and meaning. " +
    "Vary sentence length and structure noticeably — mix short and long sentences. " +
    "Avoid repetitive sentence openers and uniform paragraph rhythm. " +
    "Use natural academic transitions and occasional hedging language (e.g. 'this suggests,' 'it appears that'). " +
    "Do not use contractions or informal language. Do not add new claims, remove content, or alter citations. " +
    "Do not include any preamble, explanation, or markdown — output only the rewritten text.",

  aggressive:
    "You are an academic editor. Rewrite the following thesis text to read as naturally human-written. " +
    "This text was previously flagged by an AI detector — restructure paragraph order within each section where possible, " +
    "break up long sentences more assertively, and introduce more first-person academic phrasing " +
    "(e.g. 'this study finds,' 'we observe that') while keeping all facts and citations identical. " +
    "Vary sentence length and structure noticeably. Avoid repetitive openers. " +
    "Do not use contractions or informal language. Do not add new claims, remove content, or alter citations. " +
    "Do not include any preamble, explanation, or markdown — output only the rewritten text.",
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
      model: "deepseek-v4-pro",
      system,
      user,
    });
  } catch (e: any) {
    // Retry once on rate limit
    if (e?.message?.includes("Rate limit") || e?.message?.includes("429")) {
      await new Promise((r) => setTimeout(r, 1000));
      return await callAIText(apiKey, {
        model: "deepseek-v4-pro",
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
