import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export type LearnerType = "university" | "pre_university" | "professional";
export type ExamTrack = "waec" | "neco" | "jamb";

export interface Profile {
  id: string;
  learner_type: LearnerType | null;
  university: string | null;
  department: string | null;
  level: string | null;
  exam_tracks: ExamTrack[];
  class_level: string | null;
  country: string | null;
  full_name: string | null;
}

function runtimeEnv(key: string): string | undefined {
  try {
    return (globalThis as any).process?.env?.[key];
  } catch {
    return undefined;
  }
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, learner_type, university, department, level, exam_tracks, class_level, country, full_name")
      .eq("id", userId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return {
      id: data.id,
      learner_type: data.learner_type ?? null,
      university: data.university ?? null,
      department: data.department ?? null,
      level: data.level ?? null,
      exam_tracks: Array.isArray(data.exam_tracks) ? data.exam_tracks : [],
      class_level: data.class_level ?? null,
      country: data.country ?? null,
      full_name: data.full_name ?? null,
    } as Profile;
  });

const SaveProfileInput = z.object({
  learner_type: z.enum(["university", "pre_university", "professional"]),
  university: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  level: z.string().max(50).optional(),
  exam_tracks: z.array(z.enum(["waec", "neco", "jamb"])).default([]),
  class_level: z.string().max(50).optional(),
});

export const saveMyProfile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SaveProfileInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const isUniversity = data.learner_type === "university";
    const isPreUni = data.learner_type === "pre_university";

    if (isUniversity && !data.university?.trim()) {
      throw new Error("Please enter your university.");
    }
    if (isPreUni && data.exam_tracks.length === 0) {
      throw new Error("Select at least one exam track (WAEC / NECO / JAMB).");
    }

    const row = {
      id: userId,
      learner_type: data.learner_type,
      university: isUniversity ? (data.university?.trim() || null) : null,
      department: isUniversity ? (data.department?.trim() || null) : null,
      level: isUniversity ? (data.level?.trim() || null) : null,
      exam_tracks: isPreUni ? data.exam_tracks : [],
      class_level: isPreUni ? (data.class_level?.trim() || null) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("profiles").upsert(row, { onConflict: "id" });
    if (error) throw new Error(error.message);

    // Mirror a summary into Clerk publicMetadata (profiles table stays the source of truth).
    try {
      const clerkSecretKey = runtimeEnv("CLERK_SECRET_KEY");
      if (clerkSecretKey) {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: clerkSecretKey });
        const existing = await clerk.users.getUser(userId);
        const meta = (existing.publicMetadata ?? {}) as Record<string, any>;

        await clerk.users.updateUser(userId, {
          publicMetadata: {
            ...meta,
            learnerType: data.learner_type,
            university: isUniversity ? (row.university ?? "") : "",
            department: isUniversity ? (row.department ?? "") : "",
            level: isUniversity ? (row.level ?? "") : "",
            examTracks: row.exam_tracks,
            classLevel: isPreUni ? (row.class_level ?? "") : "",
          },
        });
      }
    } catch {
      // Non-critical — the profiles row is the source of truth.
    }

    return { ok: true };
  });
