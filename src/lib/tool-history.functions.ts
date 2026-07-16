import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export const listAssignments = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    // Select broad columns — use * first, then fall back if new cols missing
    let data: any[] | null = null;
    let error: any = null;

    // Try with all columns (new schema)
    try {
      const result = await supabase
        .from("assignments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      data = result.data;
      error = result.error;
    } catch {
      // ignore
    }

    // Fallback to known legacy columns
    if (error || !data) {
      const result = await supabase
        .from("assignments")
        .select("id, question, answer, word_count, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (result.error) throw new Error(result.error.message);
      return result.data ?? [];
    }

    return data ?? [];
  });

export const getAssignment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: row, error } = await supabase
      .from("assignments")
      .select("*, sections, abstract, word_count_target, academic_level, grading_target, title")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listExams = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("exams")
      .select("id, subject_notes, total_questions, question_type, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getExam = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: row, error } = await supabase
      .from("exams")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteExam = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("exams")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPresentations = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("presentations")
      .select("id, topic, slide_count, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getPresentation = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: row, error } = await supabase
      .from("presentations")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePresentation = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("presentations")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCvs = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("cvs")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getCv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: row, error } = await supabase
      .from("cvs")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("cvs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listSideHustles = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("side_hustles")
      .select("id, answers, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getSideHustle = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { data: row, error } = await supabase
      .from("side_hustles")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", userId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteSideHustle = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const { error } = await supabase
      .from("side_hustles")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
