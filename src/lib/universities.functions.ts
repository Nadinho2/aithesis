import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export interface Department {
  id: string;
  name: string;
}

export interface University {
  id: string;
  name: string;
  country: string | null;
  departments: Department[];
}

// ─── List the directory (for onboarding / settings / admin) ─────────────────
export const listUniversities = createServerFn({ method: "GET" })
  .middleware([requireClerkAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;

    const { data: unis, error: uniErr } = await supabase
      .from("universities")
      .select("id, name, country")
      .order("name", { ascending: true });
    if (uniErr) throw new Error(uniErr.message);

    const { data: depts, error: deptErr } = await supabase
      .from("departments")
      .select("id, name, university_id")
      .order("name", { ascending: true });
    if (deptErr) throw new Error(deptErr.message);

    const byUni = new Map<string, Department[]>();
    for (const d of (depts ?? []) as Array<{ id: string; name: string; university_id: string }>) {
      const list = byUni.get(d.university_id) ?? [];
      list.push({ id: d.id, name: d.name });
      byUni.set(d.university_id, list);
    }

    return ((unis ?? []) as Array<{ id: string; name: string; country: string | null }>).map((u) => ({
      id: u.id,
      name: u.name,
      country: u.country ?? null,
      departments: byUni.get(u.id) ?? [],
    })) as University[];
  });

// ─── Admin: manage universities ────────────────────────────────────────────
export const adminAddUniversity = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ name: z.string().min(1).max(200), country: z.string().max(100).optional() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase
      .from("universities")
      .insert({ name: data.name.trim(), country: data.country?.trim() || null });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteUniversity = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase.from("universities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Admin: manage departments ─────────────────────────────────────────────
export const adminAddDepartment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ university_id: z.string().uuid(), name: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase
      .from("departments")
      .insert({ university_id: data.university_id, name: data.name.trim() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteDepartment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase.from("departments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Admin: bulk import universities + departments from CSV ─────────────────
// Expected format (header optional): "University,Department" per line.
export const adminImportUniversitiesCsv = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ csv: z.string().min(1).max(200_000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const lines = data.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    let rows = lines;
    const first = lines[0]?.toLowerCase() ?? "";
    if (first.includes("university") || first.includes("department") || first.includes("faculty")) {
      rows = lines.slice(1);
    }

    const uniIdByName = new Map<string, string>();
    let universities = 0;
    let departments = 0;

    for (const line of rows) {
      const parts = line
        .split(",")
        .map((p) => p.trim().replace(/^"|"$/g, ""));

      const uniName = parts[0]?.trim();
      const deptName = parts[1]?.trim();
      if (!uniName) continue;

      let universityId = uniIdByName.get(uniName);
      if (!universityId) {
        const { data: u, error } = await supabase
          .from("universities")
          .upsert({ name: uniName }, { onConflict: "name" })
          .select("id")
          .single();
        if (error) throw new Error(`University "${uniName}": ${error.message}`);
        universityId = u.id as string;
        uniIdByName.set(uniName, universityId);
        universities += 1;
      }

      if (deptName) {
        const { error } = await supabase
          .from("departments")
          .upsert({ university_id: universityId, name: deptName }, { onConflict: "university_id,name" });
        if (error) throw new Error(`Department "${deptName}" (${uniName}): ${error.message}`);
        departments += 1;
      }
    }

    return { universities, departments };
  });
