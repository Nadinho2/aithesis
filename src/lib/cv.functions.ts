import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { notifyToolCompleted } from "./mail-helper";
import { parseUploadedFile } from "./upload.server";
import { buildCvDocx, toBase64 } from "./docx.server";
import { checkGenerateLimit } from "./admin-limits.functions";

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
  // Job tailoring
  tailor_mode: z.boolean().optional(),
  job_description: z.string().optional(),
  job_title: z.string().optional(),
  company: z.string().optional(),
});

export const generateCv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CvInput.parse(i))
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
        .eq("product", "cv")
        .eq("used", false);
      isPaid = (count ?? 0) > 0;
    } catch { /* ignore */ }

    if (!isPaid) {
      try {
        const freshCutoff = new Date(Date.now() - 3 * 60 * 1000).toISOString();
        const { count: pendingCount } = await (supabase as any)
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("status", "pending")
          .eq("product", "cv")
          .gte("created_at", freshCutoff);
        isPaid = (pendingCount ?? 0) > 0;
      } catch { /* ignore */ }
    }

    if (!isPaid) {
      try {
        isPaid = await checkGenerateLimit(supabase, userId, "cv");
      } catch { /* ignore */ }
    }

    if (!isPaid) {
      return { ok: false, code: "PAYMENT_REQUIRED" as const, price: 3000 };
    }
    // ── End payment guard ──

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
      cvInfo = raw;
    } else if (data.manual) {
      cvInfo = data.manual;
    }

    const headshot = data.headshot_base64 ?? null;
    const isTailoring = data.tailor_mode && data.job_description && data.job_description.trim().length >= 50;

    let finalEnhanced: string;

    if (isTailoring) {
      // ── Job-targeted tailoring ──
      const targetTitle = data.job_title || "the target role";
      const targetCompany = data.company || "the company";

      // Step 1: Analyze the job description
      let jdAnalysis: any = {};
      try {
        jdAnalysis = await callAI(apiKey, {
          model: "deepseek-reasoner",
          max_tokens: 2048,
          system: `You are a job market analyst. Analyze this job description and extract:

1. 5-8 KEY REQUIREMENTS (skills, experience, qualifications they explicitly want)
2. 5-8 KEYWORDS / PHRASES that appear repeatedly or are emphasised
3. SENIORITY LEVEL (Entry / Mid / Senior / Lead / Executive)
4. INDUSTRY / SECTOR
5. COMPANY CULTURE INDICATORS (fast-paced? collaborative? data-driven? customer-focused?)
6. TOP 3 THINGS the hiring manager cares about most

Return ONLY valid JSON (no markdown, no code fences):
{
  key_requirements: string[],
  keywords: string[],
  seniority: string,
  industry: string,
  culture_indicators: string[],
  top_priorities: string[]
}`,
          user: data.job_description!,
        });
      } catch (e: any) {
        console.error("JD analysis failed, falling back to basic tailoring:", e?.message ?? e);
        jdAnalysis = {
          industry: "Unknown",
          seniority: "Mid",
          key_requirements: [],
          keywords: [],
          top_priorities: [],
          culture_indicators: [],
        };
      }

      // Step 2: Tailor the CV for this specific job
      const tailored = await callAI(apiKey, {
        model: "deepseek-reasoner",
        max_tokens: 4096,
        system: `You are a professional CV writer helping a candidate tailor their CV for a specific job application.

TARGET JOB: ${targetTitle} ${data.company ? "at " + targetCompany : ""}
INDUSTRY: ${jdAnalysis?.industry || "Unknown"}
SENIORITY: ${jdAnalysis?.seniority || "Mid"}

JOB DESCRIPTION ANALYSIS:
- Key Requirements: ${(jdAnalysis?.key_requirements || []).join("; ")}
- Important Keywords: ${(jdAnalysis?.keywords || []).join(", ")}
- Top Priorities: ${(jdAnalysis?.top_priorities || []).join("; ")}

TAILORING RULES:
- summary: Rewrite the professional summary to mirror the JD language. Lead with the most relevant experience for this role. Mention the target role directly. Include 2-3 achievements that align with the top priorities.
- education: Keep chronological. No changes unless a specific degree is a hard requirement — then highlight it.
- experience: For each role, reframe bullet points to emphasise achievements that match the key requirements. Add context showing how past work prepared the candidate for this specific role. If a past role is less relevant, condense it but don't remove it — gaps look bad on CVs.
- skills: REORDER — put JD-matching skills FIRST, then transferable skills, then tangentially relevant skills. If a skill is irrelevant to the job, keep it brief at the end. Add any implied skills from experience that match JD keywords.
- certifications: Highlight any certs mentioned or relevant to the JD. Keep all certs.
- languages: Keep as-is unless language requirements differ from current CV.

ABSOLUTE RULES:
- NEVER fabricate experience, skills, or qualifications the candidate doesn't have
- NEVER remove real experience or education
- Add JD keywords NATURALLY — no keyword stuffing. The CV must still read like a human wrote it.
- Keep the candidate's voice and factual history intact
- Output MUST be valid JSON with the same fields as the input

Return ONLY valid JSON (no markdown, no code fences):
{ full_name, email, phone, address, summary, education, experience, skills, certifications, languages }`,
        user: JSON.stringify(cvInfo),
      });

      finalEnhanced = typeof tailored === "string" ? tailored.trim() : JSON.stringify(tailored);
    } else {
      // ── Generic professional enhancement (existing behaviour) ──
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

      finalEnhanced = typeof enhanced === "string" ? enhanced.trim() : JSON.stringify(enhanced);
    }

    // Store in DB (fire-and-forget)
    if (supabase) {
      try {
        await supabase.from("cvs").insert({
          user_id: userId,
          cv_data: cvInfo,
          enhanced: finalEnhanced,
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

    return { info: cvInfo, enhanced: finalEnhanced, headshot };
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
