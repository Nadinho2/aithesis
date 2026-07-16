import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { notifyToolCompleted } from "./mail-helper";
import { parseUploadedFile } from "./upload.server";
import { buildPresentationDocx, toBase64 } from "./docx.server";
import { checkGenerateLimit } from "./admin-limits.functions";

const PresentationInput = z.object({
  topic: z.string().max(300).default(""),
  content: z.string().max(20000).default(""),
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

    // ── Server-side payment guard ──
    let isPaid = false;
    try {
      const { count } = await (supabase as any)
        .from("transactions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "completed")
        .eq("product", "presentation")
        .eq("used", false);
      isPaid = (count ?? 0) > 0;
    } catch { /* ignore */ }

    if (!isPaid) {
      // Check pending payments (paid in last 3 min, webhook not yet fired)
      try {
        const freshCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { count: pendingCount } = await (supabase as any)
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pending")
          .eq("product", "presentation")
          .gte("created_at", freshCutoff);
        isPaid = (pendingCount ?? 0) > 0;
      } catch { /* ignore */ }
    }

    if (!isPaid) {
      // Fallback: admin-assigned free credits
      try {
        isPaid = await checkGenerateLimit(supabase, userId, "presentation");
      } catch { /* ignore */ }
    }

    if (!isPaid) {
      return { ok: false, code: "PAYMENT_REQUIRED" as const, price: 3000 };
    }
    // ── End payment guard ──

    let topic = data.topic;
    let fullContent = data.content;

    // Handle image upload mode
    if (data.image_base64) {
      topic = topic || "Image-based Presentation";
      fullContent = fullContent || "The user uploaded an image containing presentation content. Generate slides based on the visual and textual content described.";
    }

    // Parse uploaded document file
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      fullContent += "\n\n--- Uploaded content ---\n\n" + parsed.text;
    }

    const raw = await callAI(apiKey, {
      model: "deepseek-reasoner",
      max_tokens: 64000,
      system: `You are a senior academic and presentation designer creating a ${data.slide_count}-slide presentation on "${topic}" for a Nigerian university audience.

EACH SLIDE MUST HAVE:
- title: A short, punchy title (max 10 words)
- bullets: 3-6 concise bullet points (each 5-15 words, no full paragraphs)
- speaker_notes: 2-4 sentences explaining what the presenter should say — expand on the bullets, don't repeat them

SLIDE STRUCTURE:
- Slide 1: Title slide — presentation title, presenter context
- Slide 2: Agenda/Outline — what will be covered
- Slides 3-${data.slide_count - 1}: Content slides — one main idea per slide
- Last slide: Summary/Conclusion — key takeaways

DESIGN RULES:
- Bullets must be scannable — no long sentences
- Speaker notes must add value beyond the bullets
- Use academic tone but keep it accessible
- No markdown formatting in output
- No filler slides like "Thank you" or "Questions?" unless the last slide

Return ONLY valid JSON (no markdown, no code fences):
{ slides: [{ title: string, bullets: string[], speaker_notes: string }] }`,
      user: fullContent,
    });

    // callAI already returns a parsed object
    const parsed = raw;

    // Store in DB (fire-and-forget)
    if (supabase) {
      try {
        await supabase.from("presentations").insert({
          user_id: userId,
          topic,
          content: fullContent,
          slide_count: data.slide_count,
          slides: parsed.slides,
          status: "completed",
        });
      } catch (e: any) {
        console.error("Failed to save presentation to history:", e?.message ?? e);
      }
    }

    // Fire-and-forget email notification
    notifyToolCompleted(userId, "presentation", {
      title: topic,
      downloadUrl: `https://www.mybrainpadi.com/tools/history`,
    });

    return parsed;
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
