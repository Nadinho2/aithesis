import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAI } from "./ai-utils.server";
import { parseUploadedFile } from "./upload.server";

// ─── Proposal Revision ────────────────────────────────────

export const updateProposalSections = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        abstract: z.string().optional(),
        sections: z.record(z.string(), z.any()).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.abstract !== undefined) patch.abstract = data.abstract;
    if (data.sections !== undefined) patch.sections = data.sections;

    const { error } = await supabase
      .from("proposals")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviseProposalWithFeedback = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      feedback: z.string().min(10).max(50000),
      file_base64: z.string().optional(),
      file_mime: z.string().optional(),
      file_name: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    // Fetch existing proposal
    const { data: proposal, error: fetchErr } = await supabase
      .from("proposals")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (fetchErr || !proposal) throw new Error("Proposal not found");

    // Parse uploaded feedback file if provided
    let feedbackText = data.feedback;
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      feedbackText += "\n\n--- Uploaded correction document ---\n\n" + parsed.text;
    }

    // Send existing content + feedback to AI for revision
    const existingContent = JSON.stringify({
      abstract: proposal.abstract,
      sections: proposal.sections,
    }, null, 2);

    const raw = await callAI(apiKey, {
      model: "deepseek-reasoner",
      system: `You are an academic writing assistant helping a student revise their research proposal based on supervisor feedback.

RULES:
- Preserve everything the supervisor did not criticise.
- ONLY rewrite sections that the feedback directly addresses.
- Keep the same citation style and reference format.
- Maintain academic tone and the original word count per section.
- Return ONLY valid JSON matching this schema: { abstract: string, sections: { background_to_the_study, statement_of_the_problem, objectives: string[], research_questions: string[], research_hypotheses: string[], significance, scope_of_the_study, definition_of_terms, conceptual_review, empirical_review, theoretical_review, theoretical_framework, summary_of_reviews, gap_in_literature, research_design, area_of_the_study, population_of_the_study, sample_size, sampling_technique, instrumentation, validity_of_instrument, reliability_of_instrument, method_of_collecting_data, method_of_data_analysis } }`,
      user: `EXISTING PROPOSAL:\n${existingContent}\n\nSUPERVISOR FEEDBACK / CORRECTIONS:\n${feedbackText}\n\nRevise the proposal per the feedback above. Return ONLY the full updated JSON.`,
    });

    // Save revised content
    const revised = raw as any;
    const { error: updErr } = await supabase
      .from("proposals")
      .update({
        abstract: revised.abstract,
        sections: revised.sections,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    return { abstract: revised.abstract, sections: revised.sections };
  });

// ─── Thesis Revision ──────────────────────────────────────

export const updateThesisChapters = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      abstract: z.string().optional(),
      chapters: z.record(z.string(), z.string()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.abstract !== undefined) patch.abstract = data.abstract;
    if (data.chapters !== undefined) patch.chapters = data.chapters;

    const { error } = await supabase
      .from("theses")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviseThesisWithFeedback = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      feedback: z.string().min(10).max(50000),
      file_base64: z.string().optional(),
      file_mime: z.string().optional(),
      file_name: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    // Fetch existing thesis
    const { data: thesis, error: fetchErr } = await supabase
      .from("theses")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (fetchErr || !thesis) throw new Error("Thesis not found");

    // Parse uploaded feedback file if provided
    let feedbackText = data.feedback;
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      feedbackText += "\n\n--- Uploaded correction document ---\n\n" + parsed.text;
    }

    const existingContent = JSON.stringify({
      abstract: thesis.abstract,
      chapters: thesis.chapters,
    }, null, 2);

    const raw = await callAI(apiKey, {
      model: "deepseek-reasoner",
      system: `You are an academic writing assistant helping a student revise their thesis chapters based on supervisor feedback.

RULES:
- Preserve everything the supervisor did not criticise.
- ONLY rewrite chapters that the feedback directly addresses.
- Keep the same citation style and reference format.
- Maintain academic tone and the original word count per chapter.
- Return ONLY valid JSON matching this schema: { abstract: string, chapters: { chapter_1_introduction, chapter_2_literature_review, chapter_3_methodology, chapter_4_results_findings, chapter_5_discussion_conclusion } }`,
      user: `EXISTING THESIS:\n${existingContent}\n\nSUPERVISOR FEEDBACK / CORRECTIONS:\n${feedbackText}\n\nRevise the thesis per the feedback above. Return ONLY the full updated JSON.`,
    });

    const revised = raw as any;
    const { error: updErr } = await supabase
      .from("theses")
      .update({
        abstract: revised.abstract,
        chapters: revised.chapters,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    return { abstract: revised.abstract, chapters: revised.chapters };
  });

// ─── Assignment Revision ──────────────────────────────────

export const updateAssignmentSections = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      abstract: z.string().optional(),
      sections: z.record(z.string(), z.string()).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const patch: any = { updated_at: new Date().toISOString() };
    if (data.abstract !== undefined) patch.abstract = data.abstract;
    if (data.sections !== undefined) patch.sections = data.sections;

    const { error } = await supabase
      .from("assignments")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reviseAssignmentWithFeedback = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({
      id: z.string().uuid(),
      feedback: z.string().min(10).max(50000),
      file_base64: z.string().optional(),
      file_mime: z.string().optional(),
      file_name: z.string().optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("DeepSeek is not configured.");

    const { data: assignment, error: fetchErr } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (fetchErr || !assignment) throw new Error("Assignment not found");

    let feedbackText = data.feedback;
    if (data.file_base64 && data.file_mime) {
      const parsed = await parseUploadedFile(data.file_base64, data.file_mime, data.file_name ?? "");
      feedbackText += "\n\n--- Uploaded correction document ---\n\n" + parsed.text;
    }

    const sections = typeof assignment.sections === "string"
      ? JSON.parse(assignment.sections)
      : (assignment.sections ?? {});

    const existingContent = JSON.stringify(sections, null, 2);

    const raw = await callAI(apiKey, {
      model: "deepseek-reasoner",
      system: `You are an academic writing assistant helping a student revise their assignment sections based on lecturer feedback.

RULES:
- Preserve everything the lecturer did not criticise.
- ONLY rewrite sections that the feedback directly addresses.
- Keep the same citation style.
- Maintain academic tone.
- Return ONLY valid JSON matching this schema: { introduction: string, literature_review: string, analysis_1: string, analysis_2: string, discussion: string, conclusion: string }`,
      user: `EXISTING ASSIGNMENT SECTIONS:\n${existingContent}\n\nLECTURER FEEDBACK / CORRECTIONS:\n${feedbackText}\n\nRevise the assignment per the feedback above. Return ONLY the full updated JSON.`,
    });

    const revised = raw as any;
    const { error: updErr } = await supabase
      .from("assignments")
      .update({
        sections: revised,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (updErr) throw new Error(updErr.message);

    return { sections: revised };
  });
