import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CommunityPost {
  id: string;
  author_id: string;
  university: string | null;
  body: string;
  created_at: string;
  author_name: string | null;
  author_department: string | null;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  score: number;
  reasons: string[];
}

export interface CommunityComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchAuthors(
  supabase: any,
  userIds: string[],
): Promise<
  Map<string, { full_name: string | null; department: string | null; level: string | null }>
> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<
    string,
    { full_name: string | null; department: string | null; level: string | null }
  >();
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, department, level")
    .in("id", unique);

  if (!error) {
    for (const p of data ?? []) {
      map.set(p.id, {
        full_name: p.full_name ?? null,
        department: p.department ?? null,
        level: p.level ?? null,
      });
    }
  }
  return map;
}

// ─── Posts ──────────────────────────────────────────────────────────────────

export const listCommunityPosts = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({ scope: z.enum(["for_you", "university", "department", "course", "all"]).optional() })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const scope = data.scope ?? "for_you";

    const { data: profile } = await supabase
      .from("profiles")
      .select("university, department, level")
      .eq("id", userId)
      .maybeSingle();

    let q = supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (scope === "university" && profile?.university) {
      q = q.eq("university", profile.university);
    } else if (scope === "department" && profile?.department) {
      q = q.eq("department", profile.department);
    } else if (scope === "course" && profile?.level) {
      q = q.eq("level", profile.level);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const posts = (rows ?? []) as any[];
    const postIds = posts.map((r) => r.id);

    let likedByMe = new Set<string>();
    const likeCounts = new Map<string, number>();
    const commentCounts = new Map<string, number>();

    if (postIds.length > 0) {
      const [myLikesRes, likeRowsRes, commentRowsRes] = await Promise.all([
        supabase
          .from("community_likes")
          .select("post_id")
          .in("post_id", postIds)
          .eq("user_id", userId),
        supabase.from("community_likes").select("post_id").in("post_id", postIds),
        supabase.from("community_comments").select("post_id").in("post_id", postIds),
      ]);

      likedByMe = new Set((myLikesRes.data ?? []).map((l: any) => l.post_id));
      for (const l of likeRowsRes.data ?? []) {
        likeCounts.set(l.post_id, (likeCounts.get(l.post_id) ?? 0) + 1);
      }
      for (const c of commentRowsRes.data ?? []) {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
      }
    }

    const authors = await fetchAuthors(
      supabase,
      posts.map((r) => r.author_id),
    );

    const result = posts.map((r) => {
      const author = authors.get(r.author_id);
      const reasons: string[] = [];
      let score = 0;

      if (scope === "for_you") {
        if (
          profile?.university &&
          r.university &&
          r.university === profile.university
        ) {
          score += 3;
          reasons.push("Same university");
        }
        if (
          profile?.department &&
          author?.department &&
          author.department === profile.department
        ) {
          score += 3;
          reasons.push("Same department");
        }
        if (profile?.level && author?.level && author.level === profile.level) {
          score += 2;
          reasons.push("Same level");
        }
      }

      return {
        id: r.id,
        author_id: r.author_id,
        university: r.university ?? null,
        body: r.body,
        created_at: r.created_at,
        author_name: author?.full_name ?? null,
        author_department: author?.department ?? null,
        like_count: likeCounts.get(r.id) ?? 0,
        comment_count: commentCounts.get(r.id) ?? 0,
        liked_by_me: likedByMe.has(r.id),
        score,
        reasons,
      } as CommunityPost;
    });

    if (scope === "for_you") {
      result.sort(
        (a, b) =>
          b.score - a.score ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    }

    return result;
  });

const CreatePostInput = z.object({
  body: z.string().min(1).max(2000),
});

export const createCommunityPost = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CreatePostInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: profile } = await supabase
      .from("profiles")
      .select("university, department, level")
      .eq("id", userId)
      .maybeSingle();

    const row = {
      author_id: userId,
      university: profile?.university ?? null,
      department: profile?.department ?? null,
      level: profile?.level ?? null,
      body: data.body.trim(),
    };

    const { error } = await supabase.from("community_posts").insert(row);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Likes ──────────────────────────────────────────────────────────────────

export const togglePostLike = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: existing } = await supabase
      .from("community_likes")
      .select("post_id")
      .eq("post_id", data.post_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("community_likes")
        .delete()
        .eq("post_id", data.post_id)
        .eq("user_id", userId);
      if (error) throw new Error(error.message);
      return { liked: false };
    }

    const { error } = await supabase
      .from("community_likes")
      .insert({ post_id: data.post_id, user_id: userId });
    if (error) throw new Error(error.message);
    return { liked: true };
  });

// ─── Comments ───────────────────────────────────────────────────────────────

export const listComments = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;

    const { data: rows, error } = await supabase
      .from("community_comments")
      .select("*")
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const authors = await fetchAuthors(
      supabase,
      (rows ?? []).map((r: any) => r.author_id),
    );

    return (rows ?? []).map(
      (r: any) =>
        ({
          id: r.id,
          post_id: r.post_id,
          author_id: r.author_id,
          body: r.body,
          created_at: r.created_at,
          author_name: authors.get(r.author_id)?.full_name ?? null,
        }) as CommunityComment,
    );
  });

const AddCommentInput = z.object({
  post_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
});

export const addComment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AddCommentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { error } = await supabase.from("community_comments").insert({
      post_id: data.post_id,
      author_id: userId,
      body: data.body.trim(),
    });
    if (error) throw new Error(error.message);

    return { ok: true };
  });
