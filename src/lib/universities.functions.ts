import { createServerFn } from "@tanstack/react-start";
import { requireClerkAuth } from "@/integrations/clerk/clerk-auth-middleware";
import { z } from "zod";

export interface Department {
  id: string;
  name: string;
}

export interface Faculty {
  id: string;
  name: string;
  departments: Department[];
}

export interface University {
  id: string;
  name: string;
  country: string | null;
  faculties: Faculty[];
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

    const { data: facs, error: facErr } = await supabase
      .from("faculties")
      .select("id, name, university_id")
      .order("name", { ascending: true });
    if (facErr) throw new Error(facErr.message);

    const { data: depts, error: deptErr } = await supabase
      .from("departments")
      .select("id, name, university_id, faculty_id")
      .order("name", { ascending: true });
    if (deptErr) throw new Error(deptErr.message);

    const deptsByFaculty = new Map<string, Department[]>();
    const uncategorizedByUni = new Map<string, Department[]>();

    for (const d of (depts ?? []) as Array<{
      id: string;
      name: string;
      university_id: string;
      faculty_id: string | null;
    }>) {
      if (d.faculty_id) {
        const list = deptsByFaculty.get(d.faculty_id) ?? [];
        list.push({ id: d.id, name: d.name });
        deptsByFaculty.set(d.faculty_id, list);
      } else {
        const list = uncategorizedByUni.get(d.university_id) ?? [];
        list.push({ id: d.id, name: d.name });
        uncategorizedByUni.set(d.university_id, list);
      }
    }

    const facsByUni = new Map<string, Faculty[]>();
    for (const f of (facs ?? []) as Array<{
      id: string;
      name: string;
      university_id: string;
    }>) {
      const list = facsByUni.get(f.university_id) ?? [];
      list.push({ id: f.id, name: f.name, departments: deptsByFaculty.get(f.id) ?? [] });
      facsByUni.set(f.university_id, list);
    }

    return ((unis ?? []) as Array<{ id: string; name: string; country: string | null }>).map((u) => {
      const faculties = facsByUni.get(u.id) ?? [];
      const uncategorized = uncategorizedByUni.get(u.id) ?? [];
      if (uncategorized.length) {
        // Departments without a faculty are surfaced under a synthetic "Other" group.
        faculties.push({ id: "", name: "Other", departments: uncategorized });
      }
      return {
        id: u.id,
        name: u.name,
        country: u.country ?? null,
        faculties,
      };
    }) as University[];
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

// ─── Admin: manage faculties ────────────────────────────────────────────────
export const adminAddFaculty = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z.object({ university_id: z.string().uuid(), name: z.string().min(1).max(200) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase
      .from("faculties")
      .insert({ university_id: data.university_id, name: data.name.trim() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminDeleteFaculty = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase.from("faculties").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ─── Admin: manage departments ─────────────────────────────────────────────
export const adminAddDepartment = createServerFn({ method: "POST" })
  .middleware([requireClerkAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        university_id: z.string().uuid(),
        name: z.string().min(1).max(200),
        faculty_id: z.string().uuid().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, isAdmin } = context as any;
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { error } = await supabase
      .from("departments")
      .insert({
        university_id: data.university_id,
        name: data.name.trim(),
        faculty_id: data.faculty_id ?? null,
      });
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

// ─── Admin: bulk import universities + faculties + departments from CSV ─────
// Expected format (header optional): "University,Faculty,Department" per line.
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
    if (first.includes("university") || first.includes("faculty") || first.includes("department")) {
      rows = lines.slice(1);
    }

    const uniIdByName = new Map<string, string>();
    const facultyIdByKey = new Map<string, string>();
    let universities = 0;
    let faculties = 0;
    let departments = 0;

    for (const line of rows) {
      const parts = line
        .split(",")
        .map((p) => p.trim().replace(/^"|"$/g, ""));

      const uniName = parts[0]?.trim();
      const facultyName = parts[1]?.trim();
      const deptName = parts[2]?.trim();
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

      let facultyId: string | null = null;
      if (facultyName) {
        const key = `${universityId}|${facultyName}`;
        facultyId = facultyIdByKey.get(key) ?? null;
        if (!facultyId) {
          const { data: f, error } = await supabase
            .from("faculties")
            .upsert({ university_id: universityId, name: facultyName }, { onConflict: "university_id,name" })
            .select("id")
            .single();
          if (error) throw new Error(`Faculty "${facultyName}" (${uniName}): ${error.message}`);
          facultyId = f.id as string;
          facultyIdByKey.set(key, facultyId);
          faculties += 1;
        }
      }

      if (deptName) {
        const { error } = await supabase
          .from("departments")
          .upsert(
            { university_id: universityId, name: deptName, faculty_id: facultyId },
            { onConflict: "university_id,name" },
          );
        if (error) throw new Error(`Department "${deptName}" (${uniName}): ${error.message}`);
        departments += 1;
      }
    }

    return { universities, faculties, departments };
  });
