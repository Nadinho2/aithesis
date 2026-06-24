// ══════════════════════════════════════════════════════════
// SEED: University Templates
// Run with: npx tsx scripts/seedTemplates.ts
// ══════════════════════════════════════════════════════════

import { createClient } from "@supabase/supabase-js";
import {
  universities,
} from "../src/lib/seeds/universities";
import {
  universityPatternMap,
  engineeringDepartments,
  getTemplate,
} from "../src/lib/seeds/templates";

// ─── All seeded departments (non-engineering, for Pattern A/B/D) ───
const socialScienceDepartments = [
  "Computer Science",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Biology",
  "Biochemistry",
  "Microbiology",
  "Statistics",
  "Sociology",
  "Political Science",
  "Mass Communication",
  "Psychology",
  "Economics",
  "Geography",
  "Business Administration",
  "Accounting",
  "Banking and Finance",
  "Marketing",
  "Insurance",
  "Education/Computer Science",
  "Education/Mathematics",
  "Education/English",
  "Guidance and Counselling",
  "Nursing",
  "Pharmacy",
  "Public Health",
  "Medical Laboratory Science",
  "Human and Personnel Management",
  "Public Administration",
];

const MOUAU_DEPARTMENTS = [
  "Human and Personnel Management",
  "Business Administration",
  "Accounting",
  "Marketing",
  "Banking and Finance",
  "Public Administration",
  "Mass Communication",
  "Sociology",
  "Political Science",
  "Economics",
];

// Requires env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function upsertTemplate(
  shortName: string,
  department: string,
  pattern: string
) {
  const tmpl = getTemplate(pattern);
  if (!tmpl) {
    console.warn(`No pattern "${pattern}" found — skipping`);
    return;
  }

  // Patterns with IEEE citation for engineering/tech schools
  const citationStyle = pattern === "C" ? "ieee" : "apa";
  const font = pattern === "D" ? "Arial" : "Times New Roman";
  const lineSpacing = pattern === "B" || pattern === "D" ? "2.0" : "1.5";

  const payload = {
    short_name: `${shortName}_${department
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, "_")}`,
    referencing_style: citationStyle,
    font_style: font,
    font_size: 12,
    line_spacing: lineSpacing,
    thesis_chapters: JSON.parse(JSON.stringify(tmpl.thesis_chapters)),
    proposal_chapters: JSON.parse(JSON.stringify(tmpl.proposal_chapters.filter((c) => c.order <= 3))),
  };

  const { error } = await supabase.from("university_templates").upsert(payload, {
    onConflict: "short_name",
    ignoreDuplicates: false,
  });

  if (error) {
    console.error(`Error upserting ${shortName}/${department}:`, error.message);
  } else {
    console.log(`✓ ${shortName} — ${department} (Pattern ${pattern})`);
  }
}

async function main() {
  console.log("Seeding university templates...\n");

  // Skip MOUAU — already seeded
  const unprocessed = universities.filter(
    (u) => u.short_name !== "MOUAU"
  );

  for (const uni of unprocessed) {
    const pattern = universityPatternMap[uni.short_name];
    if (!pattern) {
      console.warn(`No pattern mapping for ${uni.short_name} — skipping`);
      continue;
    }

    if (pattern === "A") {
      // Pattern A: all social science depts
      for (const dept of socialScienceDepartments) {
        // Check if this university/department should use engineering (Pattern C)
        const useEng =
          (uni.short_name === "UNIPORT" || uni.short_name === "ABU") &&
          engineeringDepartments.includes(dept);
        await upsertTemplate(uni.short_name, dept, useEng ? "C" : "A");
      }
    } else if (pattern === "B") {
      // Pattern B: all social science depts
      for (const dept of socialScienceDepartments) {
        await upsertTemplate(uni.short_name, dept, "B");
      }
    } else if (pattern === "C") {
      // Pattern C: engineering depts + Comp Sci at FUTO/FUTA
      for (const dept of [
        ...engineeringDepartments,
        "Computer Science",
      ]) {
        // Only Comp Sci at FUTO/FUTA uses Pattern C
        if (
          dept === "Computer Science" &&
          uni.short_name !== "FUTO" &&
          uni.short_name !== "FUTA"
        )
          continue;
        await upsertTemplate(uni.short_name, dept, "C");
      }
    } else if (pattern === "D") {
      // Pattern D: all departments at private universities
      for (const dept of socialScienceDepartments) {
        await upsertTemplate(uni.short_name, dept, "D");
      }
    }
  }

  console.log("\n✓ Seeding complete.");
}

main().catch(console.error);
