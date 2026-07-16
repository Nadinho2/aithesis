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
  Table,
  TableRow,
  TableCell,
  WidthType,
  ShadingType,
  BorderStyle,
} from "docx";
import { formatAPAParts, formatAPAPartsHarvard, formatPartsByStyle, sortReferences, type ScholarlyRef } from "./scholarly.server";

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
const SUBHEADING_RE = /^(?:\d+(?:\.\d+){0,3}\s+[A-Z][^.!?]{2,90}|(?:Abstract|Introduction|Background to the Study|Statement of Problem|Objective of the Study|Research Questions?|Research Hypothesis|Significant of the Study|Scope of the Study|Definition of Terms|Conceptual Review|Empirical Review|Theoretical Review|Theoretical Framework|Summary of Reviews|Gap in Literature|Research Design|Area of the Study|Population of the Study|Sample Size|Sampling Techniques?|Instrument for Data Collection|Validity of Instrument|Reliability of Instrument|Method of Administering Data|Method of Presentation and Data Analysis|Data Analysis and Presentation|Discussion of Findings|Summary of Findings|Conclusion|Limitations of the Study|Recommendations|References|Appendix|Appendices)\s*)$/;

function looksLikeBullet(line: string): boolean {
  return /^(?:[•\-*]\s+|\(?\d+[.)]\s+|[a-z]\)\s+)/.test(line);
}

function paragraphs(text: string): Paragraph[] {
  return parseRichText(text).filter((c): c is Paragraph => c instanceof Paragraph);
}

function parseRichText(text: string): (Paragraph | Table)[] {
  if (!text) return [];
  const normalised = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const blocks = normalised.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const out: (Paragraph | Table)[] = [];

  for (const block of blocks) {
    // Check for TABLE block
    const tableMatch = block.match(/^\[TABLE:\s*(.+?)\]([\s\S]*)/i);
    if (tableMatch) {
      const caption = tableMatch[1];
      const rows = tableMatch[2].trim().split(/\n/).map((r) => r.trim()).filter(Boolean);
      if (rows.length >= 2) {
        const parsedRows = rows.map((r) => r.replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
        const maxCols = Math.max(...parsedRows.map((r) => r.length));
        const docxRows: TableRow[] = [];
        parsedRows.forEach((row, ri) => {
          const cells = [];
          for (let c = 0; c < maxCols; c++) {
            const text = row[c] || "";
            cells.push(
              new TableCell({
                children: [new Paragraph({ children: [new TextRun({ text, bold: ri === 0 })], spacing: { after: 60 }, alignment: AlignmentType.LEFT })],
                width: { size: Math.round(9000 / maxCols), type: WidthType.DXA },
                shading: ri === 0 ? { type: ShadingType.CLEAR, fill: "eeeeee" } : undefined,
              }),
            );
          }
          docxRows.push(new TableRow({ children: cells }));
        });
        out.push(new Table({ rows: docxRows }));
        // Caption paragraph below the table
        if (caption) {
          out.push(
            new Paragraph({
              children: [new TextRun({ text: caption, italics: true, size: 18 })],
              alignment: AlignmentType.LEFT,
              spacing: { before: 60, after: 200 },
            }),
          );
        }
        continue;
      }
    }

    // Check for FIGURE block
    const figureMatch = block.match(/^\[FIGURE:\s*(.+?)\]([\s\S]*)/i);
    if (figureMatch) {
      const caption = figureMatch[1];
      const description = figureMatch[2].trim();
      // Figure placeholder box
      out.push(
        new Paragraph({
          children: [new TextRun({ text: "[ Figure placeholder — " + caption + " ]", italics: true, color: "666666", size: 20 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 200, after: 60 },
          border: { top: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" }, bottom: { style: BorderStyle.SINGLE, size: 1, color: "cccccc" } },
        }),
      );
      if (description) {
        out.push(
          new Paragraph({
            children: [new TextRun({ text: description, italics: true, size: 18, color: "666666" })],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
        );
      }
      continue;
    }

    // Regular paragraph block
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
  citation_style?: "apa_7" | "harvard";
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
    // Chapter 1: Introduction
    ["1.1 Background to the Study", "background_to_the_study", "text"],
    ["1.2 Statement of Problem", "statement_of_the_problem", "text"],
    ["1.3 Objective of the Study", "objectives", "list"],
    ["1.4 Research Questions", "research_questions", "list"],
    ["1.5 Research Hypothesis", "research_hypotheses", "list"],
    ["1.6 Significant of the Study", "significance", "text"],
    ["1.7 Scope of the Study", "scope_of_the_study", "text"],
    ["1.8 Definition of Terms", "definition_of_terms", "text"],
    // Chapter 2: Literature Review
    ["2.1 Conceptual Review", "conceptual_review", "text"],
    ["2.2 Empirical Review", "empirical_review", "text"],
    ["2.3 Theoretical Review", "theoretical_review", "text"],
    ["2.4 Theoretical Framework", "theoretical_framework", "text"],
    ["2.5 Summary of Reviews", "summary_of_reviews", "text"],
    ["2.6 Gap in Literature", "gap_in_literature", "text"],
    // Chapter 3: Methodology
    ["3.1 Research Design", "research_design", "text"],
    ["3.2 Area of the Study", "area_of_the_study", "text"],
    ["3.3 Population of the Study", "population_of_the_study", "text"],
    ["3.4 Sample Size", "sample_size", "text"],
    ["3.5 Sampling Techniques", "sampling_technique", "text"],
    ["3.6 Instrument for Data Collection", "instrumentation", "text"],
    ["3.7 Validity of Instrument", "validity_of_instrument", "text"],
    ["3.8 Reliability of Instrument", "reliability_of_instrument", "text"],
    ["3.9 Method of Administering Data", "method_of_collecting_data", "text"],
    ["3.10 Method of Presentation and Data Analysis", "method_of_data_analysis", "text"],
  ];
  children.push(heading("Chapter 1: Introduction", 1));
  for (const [title, key, kind] of ordered.slice(0, 8)) {
    const v = s?.[key];
    if (!v) continue;
    children.push(heading(title, 2));
    if (kind === "list" && Array.isArray(v)) {
      children.push(...bullets(v, true));
    } else if (typeof v === "string") {
      children.push(...paragraphs(v));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("Chapter 2: Literature Review", 1));
  for (const [title, key, kind] of ordered.slice(8, 14)) {
    const v = s?.[key];
    if (!v) continue;
    children.push(heading(title, 2));
    if (typeof v === "string") {
      children.push(...paragraphs(v));
    }
  }
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("Chapter 3: Methodology", 1));
  for (const [title, key, kind] of ordered.slice(14)) {
    const v = s?.[key];
    if (!v) continue;
    children.push(heading(title, 2));
    if (typeof v === "string") {
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
  const citationStyle = p.citation_style ?? "apa_7";
  for (const ref of sortReferences(p.references_list ?? [])) {
    const parts = formatPartsByStyle(ref, citationStyle);
    const runs: any[] = [
      new TextRun({ text: parts.authorsYear + " " }),
      new TextRun({ text: parts.title + " " }),
    ];
    if (parts.venueItalic) {
      runs.push(new TextRun({ text: parts.venueItalic, italics: true }));
      runs.push(new TextRun({ text: parts.venueTail + " " }));
    }
    if (parts.url && citationStyle === "apa_7") {
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
  citation_style?: "apa_7" | "harvard";
}): Promise<Uint8Array> {
  const children: (Paragraph | Table)[] = [];

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
    ["Chapter 5 — Summary, Conclusion and Recommendations", "chapter_5_discussion_conclusion"],
  ];
  for (let i = 0; i < ordered.length; i++) {
    const [title, key] = ordered[i];
    const v = p.chapters?.[key];
    if (!v) continue;
    children.push(heading(title, 1));
    children.push(...parseRichText(v));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  // References
  const citationStyle = p.citation_style ?? "apa_7";
  children.push(heading("References", 1));
  for (const ref of sortReferences(p.references_list ?? [])) {
    const parts = formatPartsByStyle(ref, citationStyle);
    const runs: any[] = [
      new TextRun({ text: parts.authorsYear + " " }),
      new TextRun({ text: parts.title + " " }),
    ];
    if (parts.venueItalic) {
      runs.push(new TextRun({ text: parts.venueItalic, italics: true }));
      runs.push(new TextRun({ text: parts.venueTail + " " }));
    }
    if (parts.url && citationStyle === "apa_7") {
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
  // Appendices
  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(heading("Appendix", 1));
  children.push(
    ...paragraphs("Appendix to be inserted after data collection and analysis."),
  );

  const doc = new Document({
    numbering,
    styles: baseStyles,
    sections: [{ properties: pageSection, children }],
  });
  const buf = await Packer.toBuffer(doc);
  return new Uint8Array(buf);
}

export async function buildAssignmentDocx(p: {
  title: string;
  answer?: string;
  sections?: Record<string, string>;
  abstract?: string;
  references: any[];
}): Promise<Uint8Array> {
  const sectionTitles: Record<string, string> = {
    introduction: "Introduction & Background",
    literature_review: "Literature Review & Conceptual Framework",
    analysis_1: "Analysis — Part 1",
    analysis_2: "Analysis — Part 2",
    discussion: "Discussion",
    conclusion: "Conclusion & Recommendations",
  };
  const sectionKeys = ["introduction", "literature_review", "analysis_1", "analysis_2", "discussion", "conclusion"];

  const children: any[] = [];

  // Cover page
  children.push(new Paragraph({ spacing: { before: 2400 } }));
  children.push(new Paragraph({ text: p.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  children.push(new Paragraph({ spacing: { after: 600 } }));
  children.push(new Paragraph({ text: "Academic Assignment", alignment: AlignmentType.CENTER, spacing: { after: 400 } }));
  children.push(new Paragraph({ text: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), alignment: AlignmentType.CENTER, spacing: { after: 200 } }));

  // Page break after cover
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // Abstract
  if (p.abstract) {
    children.push(new Paragraph({ text: "Abstract", heading: HeadingLevel.HEADING_1 }));
    for (const para of p.abstract.split(/\n\n+/)) {
      children.push(new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 22, italics: true })],
        spacing: { after: 120 },
      }));
    }
    children.push(new Paragraph({ spacing: { after: 200 } }));
  }

  // Sections
  const sections = p.sections ?? {};
  for (const key of sectionKeys) {
    const content = sections[key];
    if (!content?.trim()) continue;
    const title = sectionTitles[key] ?? key;

    children.push(new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }));
    for (const para of content.split(/\n\n+/)) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      // Bold sub-headings
      if (trimmed.startsWith("**") && trimmed.includes("**")) {
        const headingText = trimmed.replace(/\*\*/g, "");
        children.push(new Paragraph({
          children: [new TextRun({ text: headingText, size: 24, bold: true })],
          spacing: { before: 200, after: 100 },
        }));
        continue;
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: trimmed, size: 22 })],
        spacing: { after: 120 },
      }));
    }
  }

  // References
  if (p.references?.length > 0) {
    children.push(new Paragraph({ spacing: { before: 400 } }));
    children.push(new Paragraph({ text: "References", heading: HeadingLevel.HEADING_1 }));
    for (const ref of p.references) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: ref.apa ?? ref.title ?? "", size: 20 })],
          spacing: { after: 100 },
          indent: { left: 720, hanging: 720 },
        }),
      );
    }
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function buildPresentationDocx(p: {
  topic: string;
  slides: { title: string; bullets: string[]; speaker_notes?: string }[];
}): Promise<Uint8Array> {
  const children: any[] = [
    new Paragraph({ spacing: { before: 2400 } }),
    new Paragraph({ text: p.topic, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }),
    new Paragraph({
      text: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
  for (const [i, slide] of p.slides.entries()) {
    if (i > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(new Paragraph({ text: `Slide ${i + 1}: ${slide.title}`, heading: HeadingLevel.HEADING_1 }));
    for (const b of slide.bullets ?? []) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: `• ${b}`, size: 22 })],
          spacing: { after: 60 },
          indent: { left: 400 },
        }),
      );
    }
    if (slide.speaker_notes) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: slide.speaker_notes, size: 18, italics: true, color: "888888" })],
          spacing: { before: 100, after: 200 },
        }),
      );
    }
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export async function buildCvDocx(p: {
  info: any;
  enhanced: string;
  headshot?: string;
}): Promise<Uint8Array> {
  const children: any[] = [];
  if (p.info?.full_name) {
    children.push(new Paragraph({ text: p.info.full_name, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER }));
  }
  const contact = [p.info?.email, p.info?.phone, p.info?.address].filter(Boolean).join(" · ");
  if (contact) {
    children.push(new Paragraph({ text: contact, alignment: AlignmentType.CENTER, spacing: { after: 200 } }));
  }
  for (const para of p.enhanced.split(/\n\n+/)) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: para.trim(), size: 22 })],
        spacing: { after: 120 },
      }),
    );
  }
  return Packer.toBuffer(new Document({ sections: [{ children }] }));
}

export function toBase64(u8: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < u8.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}
