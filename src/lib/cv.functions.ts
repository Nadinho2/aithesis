import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { notifyToolCompleted } from "./mail-helper";
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
        model: "deepseek-reasoner",
        max_tokens: 4096,
        system: `You are a CV parser. Extract the following fields from the document below.
If a field is not present, use an empty string "".

Return ONLY valid JSON (no markdown, no code fences):
{
  full_name: string,
  email: string,
  phone: string,
  address: string,
  summary: string,
  education: string,
  experience: string,
  skills: string,
  certifications: string,
  languages: string
}`,
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
      model: "deepseek-reasoner",
      max_tokens: 4096,
      system: `You are a professional CV writer for the Nigerian and international job market.
Rewrite this CV information to be concise, achievement-oriented, and optimised for ATS (Applicant Tracking Systems).

FOR EACH FIELD:
- full_name: Keep as-is, capitalize properly
- email/phone/address: Keep as-is, ensure properly formatted
- summary: 3-4 lines maximum. Start with "[Role] with X years of experience..." Highlight 2-3 key achievements with measurable impact. Use industry keywords.
- education: Format as "Degree, Institution, Year". Keep chronological (most recent first).
- experience: Format each role as "Job Title at Company (Year-Year): 2-3 bullet points starting with action verbs (Led, Managed, Developed, Increased, Reduced). Include metrics where possible."
- skills: Group into categories: Technical Skills, Soft Skills, Languages. Use industry-standard terms.
- certifications: Format as "Certification Name, Issuing Body, Year"
- languages: Format as "Language: Proficiency Level (Native/Fluent/Intermediate/Basic)"

Return ONLY valid JSON (no markdown, no code fences):
{ full_name, email, phone, address, summary, education, experience, skills, certifications, languages }`,
      user: JSON.stringify(cvInfo),
    });

    const cleanedEnhanced = typeof enhanced === "string" ? enhanced.trim() : JSON.stringify(enhanced);

    // Store in DB (fire-and-forget)
    if (supabase) {
      try {
        await supabase.from("cvs").insert({
          user_id: userId,
          cv_data: cvInfo,
          enhanced: cleanedEnhanced,
          status: "completed",
        });
      } catch (e: any) {
        console.error("Failed to save CV to history:", e?.message ?? e);
      }
    }

    // Fire-and-forget email notification
    notifyToolCompleted(userId, "cv", {
      downloadUrl: `https://www.mybrainpadi.com/tools/history`,
    });

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
