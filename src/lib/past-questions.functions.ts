import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAIText } from "./ai-utils.server";

export type PastQuestionType = "objectives" | "theory";
export type QuestionCategory = "university" | "waec" | "neco" | "jamb";

export interface PastQuestion {
  id: string;
  category: QuestionCategory;
  university: string | null;
  course: string | null;
  level: string | null;
  year: string | null;
  subject: string | null;
  question_type: PastQuestionType;
  question: string;
  options: string[];
  marks: number;
}

function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

function isCorrectAnswer(selected: string, answer: string): boolean {
  return normalizeAnswer(selected) === normalizeAnswer(answer);
}

// ─── Learner scoping helpers ──────────────────────────────────────────────
export interface LearnerScope {
  learner_type: "university" | "pre_university" | "professional" | null;
  university: string | null;
  exam_tracks: string[];
}

export async function loadLearnerScope(supabase: any, userId: string): Promise<LearnerScope> {
  const { data } = await supabase
    .from("profiles")
    .select("learner_type, university, exam_tracks")
    .eq("id", userId)
    .maybeSingle();

  return {
    learner_type: (data?.learner_type ?? null) as LearnerScope["learner_type"],
    university: (data?.university ?? null) as string | null,
    exam_tracks: Array.isArray(data?.exam_tracks) ? (data.exam_tracks as string[]) : [],
  };
}

// ─── Filter facets for the browse/search UI ────────────────────────────────
export const pastQuestionFacets = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase, isAdmin } = context as any;
    const scope = await loadLearnerScope(supabase, userId);

    // Admins can browse all universities/categories for QA/testing.
    if (!isAdmin && scope.learner_type === "professional") {
      return { categories: [], universities: [], courses: [], levels: [], subjects: [] };
    }

    let q = supabase
      .from("past_questions")
      .select("category, university, course, level, subject")
      .eq("status", "published");

    if (!isAdmin) {
      if (scope.learner_type === "university") {
        q = q.eq("category", "university");
        if (scope.university) q = q.eq("university", scope.university);
      } else if (scope.learner_type === "pre_university") {
        if (scope.exam_tracks.length === 0) {
          return { categories: [], universities: [], courses: [], levels: [], subjects: [] };
        }
        q = q.in("category", scope.exam_tracks);
      }
    }

    const { data } = await q;

    const rows = (data ?? []) as Array<{
      category: string;
      university: string | null;
      course: string | null;
      level: string | null;
      subject: string | null;
    }>;

    const uniq = (values: Array<string | null>): string[] =>
      Array.from(new Set(values.filter((v): v is string => !!v))).sort();

    return {
      categories: uniq(rows.map((r) => r.category)),
      universities: uniq(rows.map((r) => r.university)),
      courses: uniq(rows.map((r) => r.course)),
      levels: uniq(rows.map((r) => r.level)),
      subjects: uniq(rows.map((r) => r.subject)),
    };
  });

// ─── Search / browse published questions (no answers leaked) ───────────────
const SearchInput = z.object({
  query: z.string().max(200).default(""),
  category: z.enum(["university", "waec", "neco", "jamb"]).optional(),
  university: z.string().max(200).optional(),
  course: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  subject: z.string().max(200).optional(),
  question_type: z.enum(["objectives", "theory"]).optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const searchPastQuestions = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SearchInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase, isAdmin } = context as any;
    const scope = await loadLearnerScope(supabase, userId);

    // Professional learners use the thesis/proposal tools, not the question bank.
    if (!isAdmin && scope.learner_type === "professional") return [];

    let query = supabase
      .from("past_questions")
      .select("id, category, university, course, level, year, subject, question_type, question, options, marks")
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(data.limit);

    // Scope category + university to the learner's own profile.
    let category = data.category;
    let university = data.university;

    if (!isAdmin) {
      if (scope.learner_type === "university") {
        category = "university";
        university = data.university || scope.university || undefined;
      } else if (scope.learner_type === "pre_university") {
        if (scope.exam_tracks.length === 0) return [];
        category =
          category && scope.exam_tracks.includes(category)
            ? category
            : (scope.exam_tracks[0] as QuestionCategory);
        university = undefined;
      }
    }

    if (category) query = query.eq("category", category);
    if (university) query = query.eq("university", university);
    if (data.course) query = query.eq("course", data.course);
    if (data.level) query = query.eq("level", data.level);
    if (data.subject) query = query.eq("subject", data.subject);
    if (data.question_type) query = query.eq("question_type", data.question_type);
    if (data.query.trim()) query = query.ilike("question", `%${data.query.trim()}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      category: r.category,
      university: r.university,
      course: r.course,
      level: r.level,
      year: r.year,
      subject: r.subject,
      question_type: r.question_type,
      question: r.question,
      options: Array.isArray(r.options) ? r.options : [],
      marks: r.marks ?? 0,
    })) as PastQuestion[];
  });

// ─── Submit a batch of quiz answers (grades + records + updates signals) ───
const SubmitQuizInput = z.object({
  answers: z
    .array(
      z.object({
        question_id: z.string().uuid(),
        selected_answer: z.string().max(5000),
      }),
    )
    .min(1)
    .max(100),
});

export interface QuizResult {
  question_id: string;
  is_correct: boolean | null;
  correct_answer: string;
  explanation: string | null;
}

export const submitPastQuestionQuiz = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SubmitQuizInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const ids = data.answers.map((a) => a.question_id);
    const { data: rows, error } = await supabase
      .from("past_questions")
      .select("id, subject, course, question_type, answer, explanation")
      .in("id", ids);

    if (error) throw new Error(error.message);

    const byId = new Map<string, any>((rows ?? []).map((r: any) => [r.id, r]));

    const results: QuizResult[] = [];
    const attempts: Array<{
      user_id: string;
      question_id: string;
      selected_answer: string;
      is_correct: boolean | null;
    }> = [];

    const wrongSignals: Array<{
      user_id: string;
      topic: string;
      signal_type: string;
      weight: number;
      metadata: Record<string, unknown>;
    }> = [];

    for (const a of data.answers) {
      const q = byId.get(a.question_id);
      if (!q) continue;

      const theory = q.question_type === "theory";
      const correct = theory ? null : isCorrectAnswer(a.selected_answer, q.answer);

      results.push({
        question_id: a.question_id,
        is_correct: correct,
        correct_answer: q.answer,
        explanation: q.explanation ?? null,
      });

      attempts.push({
        user_id: userId,
        question_id: a.question_id,
        selected_answer: a.selected_answer,
        is_correct: correct,
      });

      if (correct === false) {
        wrongSignals.push({
          user_id: userId,
          topic: (q.subject || q.course || "General").trim(),
          signal_type: "wrong_answer",
          weight: 1,
          metadata: {
            question_id: a.question_id,
            course: q.course ?? null,
            question_type: q.question_type,
            selected_answer: a.selected_answer,
            correct_answer: q.answer,
          },
        });
      }
    }

    // Record attempts (non-blocking best effort)
    if (attempts.length > 0) {
      await supabase.from("past_question_attempts").insert(attempts);
    }

    // Record wrong-answer learning signal events (best effort, never fail the quiz)
    if (wrongSignals.length > 0) {
      try {
        await supabase.from("learning_signal_events").insert(wrongSignals);
      } catch {
        // Non-critical — don't fail the quiz submission
      }
    }

    // Aggregate learning signals per subject (non-blocking best effort)
    const signalMap = new Map<string, { attempts: number; correct: number; weak: string[] }>();
    for (const a of data.answers) {
      const q = byId.get(a.question_id);
      if (!q) continue;
      const subject = (q.subject || q.course || "General").trim();
      const entry = signalMap.get(subject) ?? { attempts: 0, correct: 0, weak: [] };
      entry.attempts += 1;
      const correct = q.question_type === "theory" ? null : isCorrectAnswer(a.selected_answer, q.answer);
      if (correct === true) entry.correct += 1;
      if (correct === false) entry.weak.push(subject);
      signalMap.set(subject, entry);
    }

    for (const [subject, entry] of signalMap) {
      try {
        const { data: existing } = await supabase
          .from("learning_signals")
          .select("id, attempts, correct, weak_concepts")
          .eq("user_id", userId)
          .eq("subject", subject)
          .maybeSingle();

        const attempts = (existing?.attempts ?? 0) + entry.attempts;
        const correct = (existing?.correct ?? 0) + entry.correct;
        const weak = Array.from(
          new Set([...(existing?.weak_concepts ?? []), ...entry.weak]),
        );

        await supabase
          .from("learning_signals")
          .upsert(
            {
              user_id: userId,
              subject,
              attempts,
              correct,
              weak_concepts: weak,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,subject" },
          );
      } catch {
        // Non-critical — don't fail the quiz submission
      }
    }

    return results;
  });

// ─── Current user's learning signals (weak areas) ──────────────────────────
export const getLearningSignals = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("learning_signals")
      .select("subject, attempts, correct, weak_concepts")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ─── Ask PADI: inline explanation for a specific question ─────────────────
const AskPadiInput = z.object({ question_id: z.string().uuid() });

export const askPadiAboutQuestion = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AskPadiInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: q, error } = await supabase
      .from("past_questions")
      .select("id, question, options, answer, explanation, subject, course, question_type")
      .eq("id", data.question_id)
      .eq("status", "published")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!q) throw new Error("Question not found.");

    const topic = (q.subject || q.course || "General").trim();

    // Strong signal: asking PADI for help means deeper confusion than a wrong answer.
    try {
      await supabase.from("learning_signal_events").insert({
        user_id: userId,
        topic,
        signal_type: "ask_padi_click",
        weight: 3,
        metadata: { question_id: q.id, question_type: q.question_type },
      });
    } catch {
      // Non-critical
    }

    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) throw new Error("AI is not configured yet.");

    const opts = Array.isArray(q.options) ? q.options : [];
    const optionsBlock = opts.length
      ? `\nOptions:\n${opts
          .map((o: string, i: number) => `${String.fromCharCode(65 + i)}. ${o}`)
          .join("\n")}`
      : "";

    const system =
      "You are PADI, a helpful study assistant for Nigerian university students. " +
      "The student is asking about a specific past question they just attempted. " +
      "Explain the correct answer clearly and simply, and why other options are wrong. " +
      "Use plain text only, no markdown. Keep it focused and encouraging.";

    const user =
      `Question: ${q.question}` +
      optionsBlock +
      `\nCorrect answer: ${q.answer}` +
      (q.explanation ? `\nStatic explanation: ${q.explanation}` : "") +
      (q.subject ? `\nSubject: ${q.subject}` : "") +
      (q.course ? `\nCourse: ${q.course}` : "") +
      `\n\nExplain this question and its correct answer in a helpful, encouraging way.`;

    const answer = await callAIText(apiKey, {
      model: "deepseek-v4-flash",
      system,
      user,
    });

    return { answer: answer.trim() || "Sorry, I couldn't generate an explanation. Try again." };
  });

// ─── Admin: bulk import past questions ─────────────────────────────────────
const ImportQuestionInput = z.object({
  category: z.enum(["university", "waec", "neco", "jamb"]).default("university"),
  university: z.string().max(200).optional(),
  course: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  year: z.string().max(50).optional(),
  subject: z.string().max(200).optional(),
  question_type: z.enum(["objectives", "theory"]),
  question: z.string().min(1),
  options: z.array(z.string()).default([]),
  answer: z.string().min(1),
  explanation: z.string().optional(),
  marks: z.number().int().min(0).max(100).default(0),
});

export const adminImportPastQuestions = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ questions: z.array(ImportQuestionInput).min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden: admin role required");
    const supabase = context.supabase as any;

    const universityNames = await loadUniversityNames(supabase);

    const rows = data.questions.map((q) => {
      const isUniversity = q.category === "university";
      if (isUniversity && !q.university) throw new Error("University questions require a university.");
      if (isUniversity && !q.course) throw new Error("University questions require a course.");
      if (!isUniversity && !q.subject) throw new Error(`${q.category.toUpperCase()} questions require a subject.`);

      return {
        category: q.category,
        university: isUniversity ? canonicalUniversityName(q.university ?? "", universityNames) : null,
        course: isUniversity ? q.course : null,
        level: isUniversity ? q.level ?? null : null,
        year: q.year ?? null,
        subject: isUniversity ? (q.subject ?? null) : q.subject,
        question_type: q.question_type,
        question: q.question,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation ?? null,
        marks: q.marks,
        status: "published",
      };
    });

    const { data: inserted, error } = await supabase
      .from("past_questions")
      .insert(rows)
      .select("id");

    if (error) throw new Error(error.message);
    return { imported: inserted?.length ?? 0 };
  });

// ─── Admin: bulk import past questions from CSV ────────────────────────────
// Columns: category,university,course,level,year,subject,question_type,question,options,answer,explanation,marks
// Header row optional. Options use "|" separators (objectives only).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }

  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);

  return rows;
}

function normalizeCategory(raw: string): QuestionCategory | null {
  const v = (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!v) return "university";
  if (v.includes("university")) return "university";
  if (v.includes("waec")) return "waec";
  if (v.includes("neco")) return "neco";
  if (v.includes("jamb")) return "jamb";
  return null;
}

function normalizeQuestionType(raw: string): PastQuestionType | null {
  const v = (raw ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (!v) return "objectives";
  if (v.includes("objectiv") || v.includes("mcq") || v.includes("multiple choice") || v === "obj") return "objectives";
  if (v.includes("theor") || v.includes("essay") || v.includes("subjective") || v.includes("written")) return "theory";
  return null;
}

async function loadUniversityNames(supabase: any): Promise<string[]> {
  const { data } = await supabase.from("universities").select("name").limit(1000);
  return ((data ?? []) as Array<{ name: string }>).map((u) => u.name.trim()).filter(Boolean);
}

// Normalize a free-text university to its canonical directory name so learner
// scoping (exact .eq on university) matches what onboarding saved on profiles.
function canonicalUniversityName(raw: string, names: string[]): string {
  const input = (raw ?? "").trim();
  if (!input) return input;

  const exact = names.find((n) => n.toLowerCase() === input.toLowerCase());
  if (exact) return exact;

  // "Imo State University (IMSU)" -> "Imo State University"
  const stripped = input.replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (stripped && stripped.toLowerCase() !== input.toLowerCase()) {
    const match = names.find((n) => n.toLowerCase() === stripped.toLowerCase());
    if (match) return match;
  }

  return input;
}

const CSV_COLUMNS = [
  "category",
  "university",
  "course",
  "level",
  "year",
  "subject",
  "question_type",
  "question",
  "options",
  "answer",
  "explanation",
  "marks",
] as const;

export const adminImportPastQuestionsCsv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ csv: z.string().min(1).max(2_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    if (!context.isAdmin) throw new Error("Forbidden: admin role required");
    const supabase = context.supabase as any;

    const universityNames = await loadUniversityNames(supabase);

    const rows = parseCsv(data.csv).filter((r) => r.some((f) => f.trim() !== ""));
    if (rows.length === 0) throw new Error("No rows found in CSV.");

    const first = rows[0].map((c) => c.trim().toLowerCase());
    const hasHeader = first.some((c) => c === "category" || c === "question");

    const colIndex: Record<string, number> = {};
    let dataRows: string[][];

    if (hasHeader) {
      first.forEach((name, idx) => {
        if (name) colIndex[name] = idx;
      });
      dataRows = rows.slice(1);
    } else {
      CSV_COLUMNS.forEach((name, idx) => (colIndex[name] = idx));
      dataRows = rows;
    }

    const get = (row: string[], name: string): string => {
      const idx = colIndex[name];
      return idx === undefined ? "" : (row[idx] ?? "").trim();
    };

    const built: Array<Record<string, unknown>> = [];

    dataRows.forEach((row, i) => {
      const lineNo = i + 1;

      const categoryRaw = get(row, "category");
      const category = normalizeCategory(categoryRaw);
      const questionTypeRaw = get(row, "question_type");
      const questionType = normalizeQuestionType(questionTypeRaw);
      const university = get(row, "university");
      const course = get(row, "course");
      const level = get(row, "level");
      const year = get(row, "year");
      const subject = get(row, "subject");
      const question = get(row, "question");
      const optionsRaw = get(row, "options");
      const answer = get(row, "answer");
      const explanation = get(row, "explanation");
      const marksRaw = get(row, "marks");

      if (!question) return; // skip blank lines

      const validCategories: QuestionCategory[] = ["university", "waec", "neco", "jamb"];
      if (!category || !validCategories.includes(category)) {
        throw new Error(`Row ${lineNo}: invalid category "${categoryRaw}".`);
      }
      const validTypes: PastQuestionType[] = ["objectives", "theory"];
      if (!questionType || !validTypes.includes(questionType)) {
        throw new Error(`Row ${lineNo}: invalid question_type "${questionTypeRaw}".`);
      }
      if (!answer) throw new Error(`Row ${lineNo}: answer is required.`);

      const isUniversity = category === "university";
      if (isUniversity && !university) throw new Error(`Row ${lineNo}: university questions require a university.`);
      if (isUniversity && !course) throw new Error(`Row ${lineNo}: university questions require a course.`);
      if (!isUniversity && !subject) throw new Error(`Row ${lineNo}: ${category.toUpperCase()} questions require a subject.`);

      const options = optionsRaw
        ? optionsRaw.split("|").map((o) => o.trim()).filter(Boolean)
        : [];
      const marks = marksRaw ? Math.max(0, Math.min(100, parseInt(marksRaw, 10) || 0)) : 0;

      built.push({
        category: category,
        university: isUniversity ? canonicalUniversityName(university, universityNames) : null,
        course: isUniversity ? course : null,
        level: isUniversity ? (level || null) : null,
        year: year || null,
        subject: !isUniversity ? subject : subject || null,
        question_type: questionType,
        question,
        options,
        answer,
        explanation: explanation || null,
        marks,
        status: "published",
      });
    });

    if (built.length === 0) throw new Error("No valid questions found in CSV.");

    const { data: inserted, error } = await supabase.from("past_questions").insert(built).select("id");
    if (error) throw new Error(error.message);
    return { imported: inserted?.length ?? 0 };
  });
