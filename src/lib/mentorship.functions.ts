import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────────────────────────────

export type MentorStatus = "pending" | "approved" | "rejected" | "paused";
export type RequestStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "completed"
  | "cancelled";

export interface MentorProfile {
  id: string;
  user_id: string;
  headline: string | null;
  bio: string | null;
  expertise_areas: string[];
  university: string | null;
  department: string | null;
  level: string | null;
  availability: string | null;
  status: MentorStatus;
  created_at: string;
}

export interface MentorCard extends MentorProfile {
  full_name: string | null;
}

export interface RecommendedMentor extends MentorCard {
  score: number;
  reasons: string[];
}

export interface MentorshipRequest {
  id: string;
  mentee_id: string;
  mentor_id: string;
  topic: string | null;
  message: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  mentee_name: string | null;
  mentor_name: string | null;
}

export interface MentorshipMessage {
  id: string;
  request_id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
  sender_name: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeMentor(row: any): MentorProfile {
  return {
    ...row,
    expertise_areas: Array.isArray(row.expertise_areas) ? row.expertise_areas : [],
  };
}

async function fetchNames(
  supabase: any,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique);

  if (!error) {
    for (const p of data ?? []) map.set(p.id, p.full_name ?? null);
  }
  return map;
}

// ─── Mentor profile (self) ──────────────────────────────────────────────────

export const getMyMentorProfile = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const { data, error } = await supabase
      .from("mentor_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;

    return normalizeMentor(data) as MentorProfile;
  });

const ApplyMentorInput = z.object({
  headline: z.string().min(3).max(200),
  bio: z.string().min(10).max(2000),
  expertise_areas: z.array(z.string().min(1).max(80)).max(10).default([]),
  university: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  level: z.string().max(80).optional(),
  availability: z.string().max(200).optional(),
});

export const applyAsMentor = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => ApplyMentorInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: existing } = await supabase
      .from("mentor_profiles")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle();

    // Preserve approval once approved; otherwise (re)submit as pending.
    const status: MentorStatus =
      existing?.status === "approved" ? "approved" : "pending";

    const row = {
      user_id: userId,
      headline: data.headline.trim(),
      bio: data.bio.trim(),
      expertise_areas: data.expertise_areas,
      university: data.university?.trim() || null,
      department: data.department?.trim() || null,
      level: data.level?.trim() || null,
      availability: data.availability?.trim() || null,
      status,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("mentor_profiles")
      .upsert(row, { onConflict: "user_id" });
    if (error) throw new Error(error.message);

    return { ok: true, status };
  });

// ─── Directory ──────────────────────────────────────────────────────────────

export const listMentors = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        university: z.string().optional(),
        department: z.string().optional(),
        level: z.string().optional(),
        query: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    let q = supabase
      .from("mentor_profiles")
      .select("*")
      .eq("status", "approved")
      .neq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data.university) q = q.eq("university", data.university);
    if (data.department) q = q.eq("department", data.department);
    if (data.level) q = q.eq("level", data.level);
    if (data.query) {
      const term = data.query.trim();
      q = q.or(`headline.ilike.%${term}%,bio.ilike.%${term}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const names = await fetchNames(
      supabase,
      (rows ?? []).map((r: any) => r.user_id),
    );

    return (rows ?? []).map(
      (r: any) =>
        ({
          ...normalizeMentor(r),
          full_name: names.get(r.user_id) ?? null,
        }) as MentorCard,
    );
  });

// ─── Recommendations ───────────────────────────────────────────────────────

export const recommendMentors = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ limit: z.number().int().min(1).max(20).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const limit = data.limit ?? 6;

    const { data: profile } = await supabase
      .from("profiles")
      .select("university, department, level")
      .eq("id", userId)
      .maybeSingle();

    const { data: rows, error } = await supabase
      .from("mentor_profiles")
      .select("*")
      .eq("status", "approved")
      .neq("user_id", userId);
    if (error) throw new Error(error.message);

    const names = await fetchNames(
      supabase,
      (rows ?? []).map((r: any) => r.user_id),
    );

    const scored: RecommendedMentor[] = (rows ?? []).map((r: any) => {
      const mentor = normalizeMentor(r);
      const reasons: string[] = [];
      let score = 0;

      if (
        profile?.university &&
        mentor.university &&
        mentor.university === profile.university
      ) {
        score += 3;
        reasons.push("Same university");
      }
      if (
        profile?.department &&
        mentor.department &&
        mentor.department === profile.department
      ) {
        score += 3;
        reasons.push("Same department");
      }
      if (profile?.level && mentor.level && mentor.level === profile.level) {
        score += 2;
        reasons.push("Same level");
      }

      return {
        ...mentor,
        full_name: names.get(mentor.user_id) ?? null,
        score,
        reasons,
      };
    });

    return scored
      .sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, limit);
  });

// ─── Requests ───────────────────────────────────────────────────────────────

const SendRequestInput = z.object({
  mentor_id: z.string().uuid(),
  topic: z.string().min(3).max(200),
  message: z.string().min(10).max(2000),
});

export const sendMentorshipRequest = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SendRequestInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: mentor, error: mentorErr } = await supabase
      .from("mentor_profiles")
      .select("user_id, status")
      .eq("id", data.mentor_id)
      .maybeSingle();
    if (mentorErr) throw new Error(mentorErr.message);
    if (!mentor || mentor.status !== "approved") {
      throw new Error("This mentor is not currently available.");
    }
    if (mentor.user_id === userId) {
      throw new Error("You cannot request yourself as a mentor.");
    }

    const { data: existing, error: existingErr } = await supabase
      .from("mentorship_requests")
      .select("id")
      .eq("mentee_id", userId)
      .eq("mentor_id", mentor.user_id)
      .in("status", ["pending", "accepted"])
      .maybeSingle();
    if (existingErr) throw new Error(existingErr.message);
    if (existing) {
      throw new Error("You already have an open request with this mentor.");
    }

    const { error } = await supabase.from("mentorship_requests").insert({
      mentee_id: userId,
      mentor_id: mentor.user_id,
      topic: data.topic.trim(),
      message: data.message.trim(),
      status: "pending",
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const listMyMentorship = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const { data: rows, error } = await supabase
      .from("mentorship_requests")
      .select("*")
      .or(`mentee_id.eq.${userId},mentor_id.eq.${userId}`)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const allIds = new Set<string>();
    for (const r of rows ?? []) {
      allIds.add(r.mentee_id);
      allIds.add(r.mentor_id);
    }
    const names = await fetchNames(supabase, [...allIds]);

    const reqs: MentorshipRequest[] = (rows ?? []).map(
      (r: any) =>
        ({
          ...r,
          mentee_name: names.get(r.mentee_id) ?? null,
          mentor_name: names.get(r.mentor_id) ?? null,
        }) as MentorshipRequest,
    );

    return {
      outgoing: reqs.filter((r) => r.mentee_id === userId),
      incoming: reqs.filter((r) => r.mentor_id === userId),
      connections: reqs.filter((r) => r.status === "accepted"),
    };
  });

const RespondInput = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
});

export const respondMentorshipRequest = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => RespondInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: req, error: reqErr } = await supabase
      .from("mentorship_requests")
      .select("*")
      .eq("id", data.request_id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found.");
    if (req.mentor_id !== userId) {
      throw new Error("Only the mentor can respond to this request.");
    }
    if (req.status !== "pending") {
      throw new Error("This request has already been handled.");
    }

    const status: RequestStatus = data.action === "accept" ? "accepted" : "declined";
    const { error } = await supabase
      .from("mentorship_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", data.request_id);
    if (error) throw new Error(error.message);

    return { ok: true, status };
  });

// ─── Messaging ──────────────────────────────────────────────────────────────

export const listMessages = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ request_id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: req, error: reqErr } = await supabase
      .from("mentorship_requests")
      .select("mentee_id, mentor_id")
      .eq("id", data.request_id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found.");
    if (req.mentee_id !== userId && req.mentor_id !== userId) {
      throw new Error("You are not part of this conversation.");
    }

    const { data: rows, error } = await supabase
      .from("mentorship_messages")
      .select("*")
      .eq("request_id", data.request_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const names = await fetchNames(
      supabase,
      (rows ?? []).map((m: any) => m.sender_id),
    );

    return (rows ?? []).map(
      (m: any) =>
        ({
          ...m,
          sender_name: names.get(m.sender_id) ?? null,
        }) as MentorshipMessage,
    );
  });

const SendMessageInput = z.object({
  request_id: z.string().uuid(),
  body: z.string().min(1).max(5000),
});

export const sendMessage = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => SendMessageInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: req, error: reqErr } = await supabase
      .from("mentorship_requests")
      .select("mentee_id, mentor_id, status")
      .eq("id", data.request_id)
      .maybeSingle();
    if (reqErr) throw new Error(reqErr.message);
    if (!req) throw new Error("Request not found.");
    if (req.mentee_id !== userId && req.mentor_id !== userId) {
      throw new Error("You are not part of this conversation.");
    }
    if (req.status !== "accepted") {
      throw new Error("Messaging is only available for accepted mentorships.");
    }

    const { error } = await supabase.from("mentorship_messages").insert({
      request_id: data.request_id,
      sender_id: userId,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Admin ──────────────────────────────────────────────────────────────────

export const adminListMentorApplications = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { data: rows, error } = await supabase
      .from("mentor_profiles")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const names = await fetchNames(
      supabase,
      (rows ?? []).map((r: any) => r.user_id),
    );

    return (rows ?? []).map(
      (r: any) =>
        ({
          ...normalizeMentor(r),
          full_name: names.get(r.user_id) ?? null,
        }) as MentorCard,
    );
  });

const ReviewMentorInput = z.object({
  user_id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export const adminReviewMentor = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => ReviewMentorInput.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const status: MentorStatus =
      data.action === "approve" ? "approved" : "rejected";
    const { error } = await supabase
      .from("mentor_profiles")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("user_id", data.user_id);
    if (error) throw new Error(error.message);

    return { ok: true, status };
  });
