import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { parseUploadedFile } from "./upload.server";
import { buildPresentationDocx, toBase64 } from "./docx.server";

const PresentationInput = z.object({
  topic: z.string().min(5).max(300),
  content: z.string().min(10).max(20000),
  slide_count: z.number().int().min(5).max(30).default(10),
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
  image_base64: z.string().optional(),
});

export const generatePresentation = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => PresentationInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    let fullContent = data.content;
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      fullContent += "\n\n--- Uploaded content ---\n\n" + parsed.text;
    }

    const raw = await callAI(undefined as any, {
      model: "deepseek-v4-pro",
      system: `You are a presentation designer. Generate ${data.slide_count} slides for a presentation on "${data.topic}".
Each slide has: title, bullets (max 6), and speaker notes.
Return ONLY valid JSON (no markdown, no code fences):
{ slides: [{ title, bullets: [], speaker_notes }] }
Keep bullets concise — presentation style.`,
      user: fullContent,
    });

    let cleaned = raw.trim().replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    const parsed = JSON.parse(cleaned);

    // Store in DB
    if (supabase) {
      await supabase.from("presentations").insert({
        user_id: userId,
        topic: data.topic,
        content: fullContent,
        slide_count: data.slide_count,
        slides: parsed.slides,
        status: "completed",
      }).catch(() => {});
    }

    return parsed;
  });

export const exportPresentationPptx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ topic: z.string(), slides: z.any() }).parse(i),
  )
  .handler(async ({ data }) => {
    // PPTX generation happens client-side via pptxgenjs
    // This function returns the data needed
    return { topic: data.topic, slides: data.slides };
  });

export const exportPresentationDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ topic: z.string(), slides: z.any() }).parse(i),
  )
  .handler(async ({ data }) => {
    const bytes = await buildPresentationDocx({ topic: data.topic, slides: data.slides });
    return toBase64(bytes);
  });
