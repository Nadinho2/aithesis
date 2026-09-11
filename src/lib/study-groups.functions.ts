import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";
import { callAIText } from "./ai-utils.server";
import { sendGroupInviteEmail } from "./mail";

// ─── Types ──────────────────────────────────────────────────────────────────

export type GroupMembershipStatus = "pending" | "approved" | "rejected";

export interface StudyGroup {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  university: string | null;
  department: string | null;
  level: string | null;
  created_at: string;
}

export interface StudyGroupCard extends StudyGroup {
  member_count: number;
  my_status: GroupMembershipStatus | "creator" | null;
}

export interface StudyGroupMember {
  user_id: string;
  full_name: string | null;
  role: "creator" | "member";
  status: GroupMembershipStatus;
  created_at: string;
}

export interface StudyGroupPost {
  id: string;
  group_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  comment_count: number;
}

export interface StudyGroupComment {
  id: string;
  post_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author_name: string | null;
  is_padi: boolean;
}

export interface StudyGroupFile {
  id: string;
  group_id: string;
  uploader_id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  created_at: string;
  expires_at: string;
  uploader_name: string | null;
  download_url: string;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

// ─── Helpers ────────────────────────────────────────────────────────────────

async function fetchNames(
  supabase: any,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, username")
    .in("id", unique);

  const profileById = new Map<string, { full_name: string | null; username: string | null }>();
  if (!error) {
    for (const p of data ?? []) {
      profileById.set(p.id, {
        full_name: p.full_name || null,
        username: p.username || null,
      });
    }
  }

  // Backfill missing usernames from Clerk in one bulk call, then persist.
  const missing = unique.filter((id) => !profileById.get(id)?.username);
  if (missing.length) {
    try {
      const clerkSecretKey = process.env.CLERK_SECRET_KEY;
      if (clerkSecretKey) {
        const { createClerkClient } = await import("@clerk/backend");
        const clerk = createClerkClient({ secretKey: clerkSecretKey });
        const res = await clerk.users.getUserList({ userId: missing, limit: missing.length });
        const patches: Array<Record<string, any>> = [];

        for (const u of res.data ?? []) {
          const existing = profileById.get(u.id) ?? { full_name: null, username: null };
          const username = u.username ?? null;
          const fullName = [u.firstName, u.lastName].filter(Boolean).join(" ").trim() || null;

          const patch: Record<string, any> = { id: u.id };
          if (username && !existing.username) {
            patch.username = username;
            existing.username = username;
          }
          if (fullName && !existing.full_name) {
            patch.full_name = fullName;
            existing.full_name = fullName;
          }
          profileById.set(u.id, existing);
          if (Object.keys(patch).length > 1) patches.push(patch);
        }

        if (patches.length) {
          await supabase.from("profiles").upsert(patches, { onConflict: "id" });
        }
      }
    } catch {
      // Clerk unavailable — keep whatever profile data we already have.
    }
  }

  // Display name: prefer username, fall back to full name.
  for (const id of unique) {
    const p = profileById.get(id);
    const display = p?.username || p?.full_name || null;
    if (display) map.set(id, display);
  }

  return map;
}

async function getMembership(
  supabase: any,
  groupId: string,
  userId: string,
): Promise<{ status: GroupMembershipStatus; role: string } | null> {
  const { data, error } = await supabase
    .from("study_group_memberships")
    .select("status, role")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function requireApprovedMembership(
  supabase: any,
  groupId: string,
  userId: string,
): Promise<void> {
  const m = await getMembership(supabase, groupId, userId);
  if (!m || m.status !== "approved") {
    throw new Error("You must be an approved member to do that.");
  }
}

function normalizeGroup(row: any): StudyGroup {
  return {
    id: row.id,
    creator_id: row.creator_id,
    name: row.name,
    description: row.description ?? null,
    university: row.university ?? null,
    department: row.department ?? null,
    level: row.level ?? null,
    created_at: row.created_at,
  };
}

// ─── Directory ──────────────────────────────────────────────────────────────

export const listStudyGroups = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        filter: z.enum(["all", "mine"]).optional(),
        query: z.string().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;
    const filter = data.filter ?? "all";

    let q = supabase
      .from("study_groups")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filter === "mine") {
      const { data: myGroups } = await supabase
        .from("study_group_memberships")
        .select("group_id")
        .eq("user_id", userId)
        .eq("status", "approved");
      const ids = (myGroups ?? []).map((r: any) => r.group_id);
      if (ids.length === 0) return [] as StudyGroupCard[];
      q = q.in("id", ids);
    }

    if (data.query?.trim()) {
      const term = data.query.trim();
      q = q.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const groups = (rows ?? []) as any[];
    const groupIds = groups.map((g) => g.id);

    let memberships: any[] = [];
    if (groupIds.length > 0) {
      const { data: m } = await supabase
        .from("study_group_memberships")
        .select("group_id, user_id, status, role")
        .in("group_id", groupIds);
      memberships = m ?? [];
    }

    const approvedCount = new Map<string, number>();
    const myStatus = new Map<string, GroupMembershipStatus | "creator">();
    for (const m of memberships) {
      if (m.status === "approved") {
        approvedCount.set(m.group_id, (approvedCount.get(m.group_id) ?? 0) + 1);
      }
      if (m.user_id === userId) {
        myStatus.set(m.group_id, m.role === "creator" ? "creator" : m.status);
      }
    }

    return groups.map(
      (g) =>
        ({
          ...normalizeGroup(g),
          member_count: approvedCount.get(g.id) ?? 0,
          my_status: myStatus.get(g.id) ?? null,
        }) as StudyGroupCard,
    );
  });

// ─── Group detail ───────────────────────────────────────────────────────────

export const getStudyGroup = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group, error } = await supabase
      .from("study_groups")
      .select("*")
      .eq("id", data.group_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!group) throw new Error("Study group not found.");

    const { data: memberships } = await supabase
      .from("study_group_memberships")
      .select("*")
      .eq("group_id", data.group_id)
      .order("created_at", { ascending: true });

    const rows = (memberships ?? []) as any[];
    const names = await fetchNames(
      supabase,
      rows.map((r) => r.user_id),
    );

    const approved = rows.filter((r) => r.status === "approved");
    const pending = rows.filter((r) => r.status === "pending");

    const toMember = (r: any): StudyGroupMember => ({
      user_id: r.user_id,
      full_name: names.get(r.user_id) ?? null,
      role: r.role,
      status: r.status,
      created_at: r.created_at,
    });

    const myRow = rows.find((r) => r.user_id === userId) ?? null;
    const isApproved = !!myRow && myRow.status === "approved";

    let invitations: any[] = [];
    if (isApproved || group.creator_id === userId) {
      const { data: invRows } = await supabase
        .from("study_group_invitations")
        .select("*")
        .eq("group_id", data.group_id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      const invArr = (invRows ?? []) as any[];
      if (invArr.length) {
        const inviteeNames = await fetchNames(
          supabase,
          invArr.map((r) => r.invitee_id),
        );
        invitations = invArr.map((r) => ({
          id: r.id,
          invitee_id: r.invitee_id,
          email: r.email ?? null,
          invitee_name: inviteeNames.get(r.invitee_id) ?? null,
          status: r.status,
          created_at: r.created_at,
        }));
      }
    }

    return {
      group: normalizeGroup(group) as StudyGroup,
      is_creator: group.creator_id === userId,
      my_status: (myRow
        ? myRow.role === "creator"
          ? "creator"
          : myRow.status
        : null) as GroupMembershipStatus | "creator" | null,
      member_count: approved.length,
      members: isApproved ? approved.map(toMember) : [],
      pending: group.creator_id === userId ? pending.map(toMember) : [],
      invitations,
    };
  });

// ─── Create group ───────────────────────────────────────────────────────────

const CreateGroupInput = z.object({
  name: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  university: z.string().max(200).optional(),
  department: z.string().max(200).optional(),
  level: z.string().max(80).optional(),
});

export const createStudyGroup = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CreateGroupInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group, error } = await supabase
      .from("study_groups")
      .insert({
        creator_id: userId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        university: data.university?.trim() || null,
        department: data.department?.trim() || null,
        level: data.level?.trim() || null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const { error: mErr } = await supabase
      .from("study_group_memberships")
      .insert({
        group_id: group.id,
        user_id: userId,
        status: "approved",
        role: "creator",
      });
    if (mErr) throw new Error(mErr.message);

    return { id: group.id };
  });

// ─── Membership ─────────────────────────────────────────────────────────────

export const requestToJoin = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group } = await supabase
      .from("study_groups")
      .select("creator_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!group) throw new Error("Study group not found.");

    const existing = await getMembership(supabase, data.group_id, userId);
    if (existing && existing.status !== "rejected") {
      throw new Error("You already have a membership request or are a member.");
    }

    const { error } = await supabase.from("study_group_memberships").upsert(
      {
        group_id: data.group_id,
        user_id: userId,
        status: "pending",
        role: "member",
        created_at: new Date().toISOString(),
      },
      { onConflict: "group_id,user_id" },
    );
    if (error) throw new Error(error.message);

    return { ok: true };
  });

const RespondMembershipInput = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().min(1),
  action: z.enum(["approve", "decline"]),
});

export const respondToJoinRequest = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => RespondMembershipInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group } = await supabase
      .from("study_groups")
      .select("creator_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!group) throw new Error("Study group not found.");
    if (group.creator_id !== userId) {
      throw new Error("Only the group creator can approve members.");
    }

    const { data: existing } = await supabase
      .from("study_group_memberships")
      .select("status")
      .eq("group_id", data.group_id)
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (!existing || existing.status !== "pending") {
      throw new Error("This request is not pending.");
    }

    if (data.action === "approve") {
      const { error } = await supabase
        .from("study_group_memberships")
        .update({ status: "approved" })
        .eq("group_id", data.group_id)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("study_group_memberships")
        .delete()
        .eq("group_id", data.group_id)
        .eq("user_id", data.user_id);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });

export const leaveGroup = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group } = await supabase
      .from("study_groups")
      .select("creator_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!group) throw new Error("Study group not found.");
    if (group.creator_id === userId) {
      throw new Error("As the creator you cannot leave; delete the group instead.");
    }

    const { error } = await supabase
      .from("study_group_memberships")
      .delete()
      .eq("group_id", data.group_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const deleteStudyGroup = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: group } = await supabase
      .from("study_groups")
      .select("creator_id")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!group) throw new Error("Study group not found.");
    if (group.creator_id !== userId) {
      throw new Error("Only the group creator can delete the group.");
    }

    const { error } = await supabase
      .from("study_groups")
      .delete()
      .eq("id", data.group_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Feed: posts ────────────────────────────────────────────────────────────

export const listGroupPosts = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    await requireApprovedMembership(supabase, data.group_id, userId);

    const { data: rows, error } = await supabase
      .from("study_group_posts")
      .select("*")
      .eq("group_id", data.group_id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const posts = (rows ?? []) as any[];
    const postIds = posts.map((p) => p.id);
    const authors = await fetchNames(
      supabase,
      posts.map((p) => p.author_id),
    );

    const commentCounts = new Map<string, number>();
    if (postIds.length > 0) {
      const { data: comments } = await supabase
        .from("study_group_comments")
        .select("post_id")
        .in("post_id", postIds);
      for (const c of comments ?? []) {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) ?? 0) + 1);
      }
    }

    return posts.map(
      (p) =>
        ({
          id: p.id,
          group_id: p.group_id,
          author_id: p.author_id,
          body: p.body,
          created_at: p.created_at,
          author_name: authors.get(p.author_id) ?? null,
          comment_count: commentCounts.get(p.id) ?? 0,
        }) as StudyGroupPost,
    );
  });

// ─── @PADI mention handling ───────────────────────────────────────────────

const PADI_MENTION = /@padi\b/i;

function hasPadiMention(text: string): boolean {
  return PADI_MENTION.test(text);
}

async function generatePadiReply(opts: {
  group: any;
  postBody: string;
  trigger: string;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return "";

  const contextLines = [
    opts.group?.name ? `Group: ${opts.group.name}` : "",
    opts.group?.department ? `Department: ${opts.group.department}` : "",
    opts.group?.level ? `Level: ${opts.group.level}` : "",
  ].filter(Boolean);
  const contextBlock = contextLines.length ? contextLines.join("\n") + "\n\n" : "";

  const system =
    "You are PADI, a friendly study assistant inside a Nigerian university study group. " +
    "Answer the student's question clearly and simply, as if teaching a peer who is still learning. " +
    "Use short paragraphs and plain text only (no markdown bold, italic, or bullet symbols). " +
    "Keep the reply focused and not overly long unless the student asks for detail. " +
    "Ground academic examples in Nigerian context where natural. Never be pushy or salesy.";

  const user =
    `${contextBlock}Group discussion (for context):\n${opts.postBody}\n\n` +
    `The message addressed to you (@PADI):\n${opts.trigger}\n\n` +
    "Reply to the student's question directly.";

  const reply = await callAIText(apiKey, {
    model: "deepseek-v4-flash",
    system,
    user,
  });
  return reply.trim();
}

async function maybeReplyAsPadi(
  supabase: any,
  postId: string,
  group: any,
  postBody: string,
  trigger: string,
): Promise<void> {
  if (!hasPadiMention(trigger)) return;
  try {
    const body = await generatePadiReply({ group, postBody, trigger });
    if (!body) return;
    await supabase.from("study_group_comments").insert({
      post_id: postId,
      author_id: "padi",
      body,
      is_padi: true,
    });
  } catch (e: any) {
    console.error("PADI group reply failed:", e?.message ?? e);
  }
}

const CreateGroupPostInput = z.object({
  group_id: z.string().uuid(),
  body: z.string().min(1).max(2000),
});

export const createGroupPost = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => CreateGroupPostInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    await requireApprovedMembership(supabase, data.group_id, userId);

    const { data: group } = await supabase
      .from("study_groups")
      .select("name, department, level")
      .eq("id", data.group_id)
      .maybeSingle();

    const body = data.body.trim();

    const { data: post, error } = await supabase
      .from("study_group_posts")
      .insert({ group_id: data.group_id, author_id: userId, body })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await maybeReplyAsPadi(supabase, post.id, group, body, body);

    return { ok: true };
  });

// ─── Feed: comments ─────────────────────────────────────────────────────────

export const listGroupComments = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ post_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: post } = await supabase
      .from("study_group_posts")
      .select("group_id")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) throw new Error("Post not found.");

    await requireApprovedMembership(supabase, post.group_id, userId);

    const { data: rows, error } = await supabase
      .from("study_group_comments")
      .select("*")
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const authors = await fetchNames(
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
          author_name: r.is_padi ? "PADI" : authors.get(r.author_id) ?? null,
          is_padi: !!r.is_padi,
        }) as StudyGroupComment,
    );
  });

const AddGroupCommentInput = z.object({
  post_id: z.string().uuid(),
  body: z.string().min(1).max(1000),
});

export const addGroupComment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => AddGroupCommentInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: post } = await supabase
      .from("study_group_posts")
      .select("group_id, body")
      .eq("id", data.post_id)
      .maybeSingle();
    if (!post) throw new Error("Post not found.");

    await requireApprovedMembership(supabase, post.group_id, userId);

    const { data: group } = await supabase
      .from("study_groups")
      .select("name, department, level")
      .eq("id", post.group_id)
      .maybeSingle();

    const body = data.body.trim();

    const { error } = await supabase.from("study_group_comments").insert({
      post_id: data.post_id,
      author_id: userId,
      body,
    });
    if (error) throw new Error(error.message);

    await maybeReplyAsPadi(supabase, data.post_id, group, post.body, body);

    return { ok: true };
  });

// ─── Files ──────────────────────────────────────────────────────────────────

async function removeExpiredFiles(supabase: any, groupId: string): Promise<void> {
  const { data: expired } = await supabase
    .from("study_group_files")
    .select("id, storage_path")
    .eq("group_id", groupId)
    .lt("expires_at", new Date().toISOString());

  for (const f of expired ?? []) {
    try {
      await supabase.storage.from("study-group-files").remove([f.storage_path]);
    } catch {
      // best-effort — row cleanup below still applies
    }
    await supabase.from("study_group_files").delete().eq("id", f.id);
  }
}

export const listGroupFiles = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ group_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    await requireApprovedMembership(supabase, data.group_id, userId);
    await removeExpiredFiles(supabase, data.group_id);

    const { data: rows, error } = await supabase
      .from("study_group_files")
      .select("*")
      .eq("group_id", data.group_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const files = (rows ?? []) as any[];
    const names = await fetchNames(
      supabase,
      files.map((f) => f.uploader_id),
    );

    const result: StudyGroupFile[] = [];
    for (const f of files) {
      let download_url = "";
      const { data: signed } = await supabase.storage
        .from("study-group-files")
        .createSignedUrl(f.storage_path, 60 * 60 * 24 * 7);
      if (signed?.signedUrl) download_url = signed.signedUrl;

      result.push({
        id: f.id,
        group_id: f.group_id,
        uploader_id: f.uploader_id,
        file_name: f.file_name,
        mime_type: f.mime_type ?? null,
        size_bytes: Number(f.size_bytes),
        created_at: f.created_at,
        expires_at: f.expires_at,
        uploader_name: names.get(f.uploader_id) ?? null,
        download_url,
      });
    }

    return result;
  });

const UploadGroupFileInput = z.object({
  group_id: z.string().uuid(),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().min(1).max(120),
  base64: z.string().min(1),
});

export const uploadGroupFile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => UploadGroupFileInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    await requireApprovedMembership(supabase, data.group_id, userId);

    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.length === 0) throw new Error("File is empty.");
    if (buffer.length > MAX_FILE_BYTES) {
      throw new Error("File is too large. Maximum size is 10 MB.");
    }

    const ext = data.file_name.includes(".")
      ? data.file_name.slice(data.file_name.lastIndexOf("."))
      : "";
    const safeName = data.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${data.group_id}/${crypto.randomUUID()}${ext}`;

    const { error: upErr } = await supabase.storage
      .from("study-group-files")
      .upload(storagePath, new Uint8Array(buffer), {
        contentType: data.mime_type,
        upsert: false,
      });
    if (upErr) throw new Error(upErr.message);

    const { data: row, error: insErr } = await supabase
      .from("study_group_files")
      .insert({
        group_id: data.group_id,
        uploader_id: userId,
        file_name: safeName,
        storage_path: storagePath,
        mime_type: data.mime_type,
        size_bytes: buffer.length,
      })
      .select("*")
      .single();
    if (insErr) {
      // Roll back the uploaded object to avoid orphans
      await supabase.storage.from("study-group-files").remove([storagePath]);
      throw new Error(insErr.message);
    }

    return { id: row.id };
  });

export const deleteGroupFile = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ file_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: file } = await supabase
      .from("study_group_files")
      .select("uploader_id, group_id, storage_path")
      .eq("id", data.file_id)
      .maybeSingle();
    if (!file) throw new Error("File not found.");

    const { data: group } = await supabase
      .from("study_groups")
      .select("creator_id")
      .eq("id", file.group_id)
      .maybeSingle();

    if (file.uploader_id !== userId && group?.creator_id !== userId) {
      throw new Error("You cannot delete this file.");
    }

    try {
      await supabase.storage.from("study-group-files").remove([file.storage_path]);
    } catch {
      // continue to row deletion
    }
    const { error } = await supabase
      .from("study_group_files")
      .delete()
      .eq("id", data.file_id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

// ─── Invitations ───────────────────────────────────────────────────────────

const SITE_URL = "https://www.mybrainpadi.com";

async function findUserByEmail(
  email: string,
): Promise<{ id: string; name: string; email: string } | null> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) return null;
  const { createClerkClient } = await import("@clerk/backend");
  const clerk = createClerkClient({ secretKey });
  const res = await clerk.users.getUserList({ emailAddress: [email], limit: 1 });
  const u = res?.data?.[0];
  if (!u) return null;
  const name =
    [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
    u.username ||
    email.split("@")[0];
  return {
    id: u.id,
    name,
    email: u.emailAddresses?.[0]?.emailAddress ?? email,
  };
}

const InviteInput = z.object({
  group_id: z.string().uuid(),
  email: z.string().email(),
});

export const inviteToGroup = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => InviteInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    await requireApprovedMembership(supabase, data.group_id, userId);

    const { data: group } = await supabase
      .from("study_groups")
      .select("id, name")
      .eq("id", data.group_id)
      .maybeSingle();
    if (!group) throw new Error("Study group not found.");

    const email = data.email.trim().toLowerCase();

    const invitee = await findUserByEmail(email);
    if (!invitee) throw new Error("No MyBrainPadi account found with that email.");

    if (invitee.id === userId) throw new Error("You can't invite yourself.");

    const existing = await getMembership(supabase, data.group_id, invitee.id);
    if (existing && existing.status === "approved") {
      throw new Error("This user is already a member.");
    }

    const { data: existingInvite } = await supabase
      .from("study_group_invitations")
      .select("id")
      .eq("group_id", data.group_id)
      .eq("invitee_id", invitee.id)
      .maybeSingle();
    if (existingInvite) throw new Error("This user has already been invited.");

    const { error } = await supabase.from("study_group_invitations").insert({
      group_id: data.group_id,
      invitee_id: invitee.id,
      invited_by: userId,
      email: invitee.email,
      status: "pending",
    });
    if (error) throw new Error(error.message);

    const names = await fetchNames(supabase, [userId]);
    const inviterName = names.get(userId) ?? "A MyBrainPadi user";

    try {
      await sendGroupInviteEmail({
        to: invitee.email,
        name: invitee.name,
        groupName: group.name,
        inviterName,
        groupUrl: `${SITE_URL}/community/study-groups/${group.id}`,
      });
    } catch {
      // Email failure must not block the invitation.
    }

    return { ok: true };
  });

export const listMyInvitations = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context as any;

    const { data: rows, error } = await supabase
      .from("study_group_invitations")
      .select("id, group_id, invited_by, created_at")
      .eq("invitee_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const invites = (rows ?? []) as any[];
    if (!invites.length) return [];

    const groupIds = [...new Set(invites.map((i) => i.group_id))];
    const { data: groups } = await supabase
      .from("study_groups")
      .select("id, name")
      .in("id", groupIds);
    const groupNameById = new Map<string, string>();
    for (const g of groups ?? []) groupNameById.set(g.id, g.name);

    const names = await fetchNames(
      supabase,
      invites.map((i) => i.invited_by),
    );

    return invites.map((i) => ({
      id: i.id,
      group_id: i.group_id,
      group_name: groupNameById.get(i.group_id) ?? "Study group",
      inviter_name: names.get(i.invited_by) ?? null,
      created_at: i.created_at,
    }));
  });

const RespondInvitationInput = z.object({
  invitation_id: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
});

export const respondToInvitation = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => RespondInvitationInput.parse(i))
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context as any;

    const { data: invite } = await supabase
      .from("study_group_invitations")
      .select("*")
      .eq("id", data.invitation_id)
      .maybeSingle();
    if (!invite) throw new Error("Invitation not found.");
    if (invite.invitee_id !== userId) {
      throw new Error("This invitation is not for you.");
    }
    if (invite.status !== "pending") {
      throw new Error("This invitation has already been answered.");
    }

    const now = new Date().toISOString();

    if (data.action === "accept") {
      const { error: mErr } = await supabase
        .from("study_group_memberships")
        .upsert(
          {
            group_id: invite.group_id,
            user_id: userId,
            status: "approved",
            role: "member",
            created_at: now,
          },
          { onConflict: "group_id,user_id" },
        );
      if (mErr) throw new Error(mErr.message);
    }

    const { error: updErr } = await supabase
      .from("study_group_invitations")
      .update({
        status: data.action === "accept" ? "accepted" : "rejected",
        responded_at: now,
      })
      .eq("id", data.invitation_id);
    if (updErr) throw new Error(updErr.message);

    return { ok: true };
  });
