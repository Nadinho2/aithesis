import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { parseUploadedFile } from "./upload.server";
import { buildCvDocx, toBase64 } from "./docx.server";

const CvInput = z.object({
  file_base64: z.string().optional(),
  file_mime: z.string().optional(),
  file_name: z.string().optional(),
  headshot_base64: z.string().optional(),
  // Manual form fields (used if no file)
  manual: z
    .object({
      full_name: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
      address: z.string().optional(),
      summary: z.string().optional(),
      education: z.string().optional(),
      experience: z.string().optional(),
      skills: z.string().optional(),
      certifications: z.string().optional(),
      languages: z.string().optional(),
    })
    .optional(),
});

export const generateCv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CvInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    let cvInfo: any = {};

    // Parse uploaded CV document to auto-fill
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      const raw = await callAI(apiKey, {
        model: "deepseek-v4-pro",
        system:
          "Extract the following fields from this CV document and return ONLY valid JSON (no markdown, no code fences): { full_name, email, phone, address, summary, education, experience, skills, certifications, languages }",
        user: parsed.text,
      });
      // callAI already returns a parsed object
      cvInfo = raw;
    } else if (data.manual) {
      cvInfo = data.manual;
    }

    const headshot = data.headshot_base64 ?? null;

    // Enhance with AI — improve wording, format professionally
    const enhanced = await callAI(apiKey, {
      model: "deepseek-v4-pro",
      system:
        "You are a professional CV writer. Improve the wording of this CV information. Make it concise, professional, and achievement-oriented. Return ONLY the improved text in the same format. No markdown.",
      user: JSON.stringify(cvInfo),
    });

    const cleanedEnhanced = typeof enhanced === "string" ? enhanced.trim() : JSON.stringify(enhanced);

    // Store in DB
    if (supabase) {
      await supabase.from("cvs").insert({
        user_id: userId,
        cv_data: cvInfo,
        enhanced: cleanedEnhanced,
        status: "completed",
      }).catch(() => {});
    }

    return { info: cvInfo, enhanced: cleanedEnhanced, headshot };
  });

export const exportCvDocx = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ info: z.any(), enhanced: z.string(), headshot: z.string().optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const bytes = await buildCvDocx({
      info: data.info ?? {},
      enhanced: data.enhanced,
      headshot: data.headshot,
    });
    return toBase64(bytes);
  });
