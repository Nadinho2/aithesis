import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  LevelFormat,
  ExternalHyperlink,
  PageBreak,
  PageOrientation,
} from "docx";
import { formatAPAParts, type ScholarlyRef } from "./scholarly.server";

const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [
        {
          level: 0,
          format: LevelFormat.BULLET,
          text: "•",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
    {
      reference: "numbers",
      levels: [
        {
          level: 0,
          format: LevelFormat.DECIMAL,
          text: "%1.",
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
      ],
    },
  ],
};

const baseStyles = {
  default: { document: { run: { font: "Times New Roman", size: 24 } } },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 32, bold: true, font: "Times New Roman" },
      paragraph: { spacing: { before: 320, after: 200 }, outlineLevel: 0 },
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { size: 28, bold: true, font: "Times New Roman" },
      paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 },
    },
  ],
};

const pageSection = {
  page: {
    size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
    margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
  },
};

// Detects scholarly subheading lines, e.g. "1.7 Definition of Terms",
// "3.2.1 Sampling", "Chapter 1", "Abstract", "Introduction" on a line of their own.
const SUBHEADING_RE = /^(?:\d+(?:\.\d+){0,3}\s+[A-Z][^.!?]{2,90}|(?:Abstract|Introduction|Background|Problem Statement|Research Questions?|Research Objectives?|Significance|Scope and Limitations|Literature Review|Methodology|Expected Outcomes|Timeline|Findings|Discussion|Conclusion|Recommendations|References|Definition of Terms)\s*)$/;

function looksLikeBullet(line: string): boolean {
  return /^(?:[•\-*]\s+|\(?\d+[.)]\s+|[a-z]\)\s+)/.test(line);
}

function paragraphs(text: string): Paragraph[] {
  if (!text) return [];
  // Normalise line endings, collapse 3+ newlines, split on blank lines OR newlines that precede a subheading.
  const normalised = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  // Pre-split into logical blocks by blank lines.
  const blocks = normalised.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: Paragraph[] = [];
  for (const block of blocks) {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    let buffer: string[] = [];
    const flush = () => {
      if (!buffer.length) return;
      out.push(
        new Paragraph({
          children: [new TextRun({ text: buffer.join(" ") })],
          spacing: { after: 200, line: 360 },
          alignment: AlignmentType.JUSTIFIED,
        }),
      );
      buffer = [];
    };
    for (const line of lines) {
      if (SUBHEADING_RE.test(line)) {
        flush();
        out.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            children: [new TextRun({ text: line, bold: true })],
            spacing: { before: 240, after: 120 },
          }),
        );
      } else if (looksLikeBullet(line)) {
        flush();
        out.push(
          new Paragraph({
            numbering: { reference: "bullets", level: 0 },
            children: [new TextRun({ text: line.replace(/^(?:[•\-*]\s+|\(?\d+[.)]\s+|[a-z]\)\s+)/, "") })],
            spacing: { after: 100, line: 320 },
          }),
        );
      } else {
        buffer.push(line);
      }
    }
    flush();
  }
  return out;
}

function bullets(items: string[], ordered = false): Paragraph[] {
  return items.map(
    (t) =>
      new Paragraph({
        numbering: { reference: ordered ? "numbers" : "bullets", level: 0 },
        children: [new TextRun({ text: t })],
        spacing: { after: 100, line: 320 },
      }),
  );
}

function heading(text: string, level: 1 | 2 = 1): Paragraph {
  return new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
    children: [new TextRun({ text })],
  });
}

export async function buildTopicsDocx(opts: {
  meta: {
    department?: string | null;
    area_of_interest?: string | null;
    country?: string | null;
    research_type?: string | null;
  };
  topics: Array<{
    title: string;
    problem_statement: string;
    research_gap: string;
    objectives: string[];
    novelty_score: number | string;
    feasibility_score: number | string;
  }>;
}): Promise<Uint8Array> {
  const children: Paragraph[] = [];
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "Research Topics", bold: true, size: 40 })],
      spacing: { after: 200 },
    }),
  );
  const metaLine = [
    opts.meta.department && `Department: ${opts.meta.department}`,
    opts.meta.area_of_interest && `Area: ${opts.meta.area_of_interest}`,
    opts.meta.country && `Context: ${opts.meta.country}`,
    opts.meta.research_type && `Type: ${opts.meta.research_type}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  if (metaLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: metaLine, italics: true, color: "555555" })],
        spacing: { after: 400 },
      }),
    );
  }

  opts.topics.forEach((t, i) => {
    children.push(heading(`${i + 1}. ${t.title}`, 1));
    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: "Novelty: ", bold: true }),
          new TextRun({ text: `${Number(t.novelty_score).toFixed(1)} / 10    ` }),
          new TextRun({ text: "Feasibility: ", bold: true }),
          new TextRun({ text: `${Number(t.feasibility_score).toFixed(1)} / 10` }),
        ],
        spacing: { after: 200 },
      }),
    );
    children.push(heading("Problem Statement", 2));
    children.push(...paragraphs(t.problem_statement));
    children.push(heading("Research Gap", 2));
    children.push(...paragraphs(t.research_gap));
    children.push(heading("Objectives", 2));
    children.push(...bullets(t.objectives ?? [], true));
    if (i < opts.topics.length - 1) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
  });

  const doc = new Document({
    numbering,
    styles: baseStyles,
    sections: [{ properties: pageSection, children }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export async function buildProposalDocx(p: {
  title: string;
  level: string;
  department?: string | null;
  area_of_interest?: string | null;
  country?: string | null;
  abstract: string | null;
  word_count: number;
  sections: Record<string, any>;
  references_list: ScholarlyRef[];
}): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "" })], spacing: { before: 1600 } }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: p.title, bold: true, size: 44 })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${p.level.charAt(0).toUpperCase() + p.level.slice(1)} Research Proposal`, italics: true, size: 28 })],
      spacing: { after: 200 },
    }),
  );
  const meta = [p.department, p.area_of_interest, p.country].filter(Boolean).join(" · ");
  if (meta) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: meta, color: "555555" })],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${p.word_count.toLocaleString()} words`, color: "777777", size: 20 })],
      spacing: { before: 200 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  if (p.abstract) {
    children.push(heading("Abstract", 1));
    children.push(...paragraphs(p.abstract));
  }

  const s = p.sections;
  const ordered: Array<[string, string, "text" | "list"]> = [
    ["1. Introduction", "introduction", "text"],
    ["2. Background of the Study", "background", "text"],
    ["3. Problem Statement", "problem_statement", "text"],
    ["4. Research Questions", "research_questions", "list"],
    ["5. Research Objectives", "objectives", "list"],
    ["6. Significance of the Study", "significance", "text"],
    ["7. Scope and Limitations", "scope_and_limitations", "text"],
    ["8. Literature Review", "literature_review", "text"],
    ["9. Methodology", "methodology", "text"],
    ["10. Expected Outcomes", "expected_outcomes", "text"],
    ["11. Timeline", "timeline", "text"],
  ];
  for (const [title, key, kind] of ordered) {
    const v = s?.[key];
    if (!v) continue;
    children.push(heading(title, 1));
    if (kind === "list" && Array.isArray(v)) {
      children.push(...bullets(v, true));
    } else if (typeof v === "string") {
      children.push(...paragraphs(v));
    }
  }

  // References — APA 7
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "References", bold: true, size: 32 })],
      spacing: { after: 300 },
    }),
  );
  for (const ref of p.references_list ?? []) {
    const parts = formatAPAParts(ref);
    const runs: any[] = [
      new TextRun({ text: parts.authorsYear + " " }),
      new TextRun({ text: parts.title + " " }),
    ];
    if (parts.venueItalic) {
      runs.push(new TextRun({ text: parts.venueItalic, italics: true }));
      runs.push(new TextRun({ text: parts.venueTail + " " }));
    }
    if (parts.url) {
      runs.push(
        new ExternalHyperlink({
          link: parts.url,
          children: [new TextRun({ text: parts.url, style: "Hyperlink", color: "1a5490" })],
        }),
      );
    }
    children.push(
      new Paragraph({
        children: runs,
        spacing: { after: 160, line: 360 },
        indent: { left: 720, hanging: 720 }, // APA hanging indent
      }),
    );
  }

  const doc = new Document({
    numbering,
    styles: baseStyles,
    sections: [{ properties: pageSection, children }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export async function buildThesisDocx(p: {
  title: string;
  level: string;
  department?: string | null;
  area_of_interest?: string | null;
  country?: string | null;
  abstract: string | null;
  word_count: number;
  chapters: Record<string, string>;
  references_list: ScholarlyRef[];
}): Promise<Uint8Array> {
  const children: Paragraph[] = [];

  // Title page
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "" })],
      spacing: { before: 2400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: p.title, bold: true, size: 48 })],
      spacing: { after: 400 },
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `A ${p.level.charAt(0).toUpperCase() + p.level.slice(1)} Thesis`,
          italics: true,
          size: 28,
        }),
      ],
      spacing: { after: 200 },
    }),
  );
  const meta = [p.department, p.area_of_interest, p.country].filter(Boolean).join(" · ");
  if (meta) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: meta, color: "555555" })],
      }),
    );
  }
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: `${p.word_count.toLocaleString()} words`, color: "777777", size: 20 }),
      ],
      spacing: { before: 200 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  );

  if (p.abstract) {
    children.push(heading("Abstract", 1));
    children.push(...paragraphs(p.abstract));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  const ordered: Array<[string, string]> = [
    ["Chapter 1 — Introduction", "chapter_1_introduction"],
    ["Chapter 2 — Literature Review", "chapter_2_literature_review"],
    ["Chapter 3 — Methodology", "chapter_3_methodology"],
    ["Chapter 4 — Results and Findings", "chapter_4_results_findings"],
    ["Chapter 5 — Discussion, Conclusion and Recommendations", "chapter_5_discussion_conclusion"],
  ];
  for (let i = 0; i < ordered.length; i++) {
    const [title, key] = ordered[i];
    const v = p.chapters?.[key];
    if (!v) continue;
    children.push(heading(title, 1));
    children.push(...paragraphs(v));
    if (i < ordered.length - 1) children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  // References — APA 7
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "References", bold: true, size: 32 })],
      spacing: { after: 300 },
    }),
  );
  for (const ref of p.references_list ?? []) {
    const parts = formatAPAParts(ref);
    const runs: any[] = [
      new TextRun({ text: parts.authorsYear + " " }),
      new TextRun({ text: parts.title + " " }),
    ];
    if (parts.venueItalic) {
      runs.push(new TextRun({ text: parts.venueItalic, italics: true }));
      runs.push(new TextRun({ text: parts.venueTail + " " }));
    }
    if (parts.url) {
      runs.push(
        new ExternalHyperlink({
          link: parts.url,
          children: [new TextRun({ text: parts.url, style: "Hyperlink", color: "1a5490" })],
        }),
      );
    }
    children.push(
      new Paragraph({
        children: runs,
        spacing: { after: 160, line: 360 },
        indent: { left: 720, hanging: 720 },
      }),
    );
  }

  const doc = new Document({
    numbering,
    styles: baseStyles,
    sections: [{ properties: pageSection, children }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export function toBase64(u8: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}
