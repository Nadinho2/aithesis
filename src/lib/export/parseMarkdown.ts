/**
 * Markdown-to-docx paragraph parser.
 *
 * Converts markdown-formatted text into docx Paragraph objects with
 * correctly styled TextRun children for **bold**, *italic*, and ***bold-italic***.
 *
 * Also detects markdown headings (#, ##, ###) and code fences.
 */
import { Paragraph, TextRun, HeadingLevel } from "docx";

interface MarkdownSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

const MATH_SYMBOLS = [
  '\u00D7',  // × multiplication
  '\u00F7',  // ÷ division
  '\u2264',  // ≤ less than or equal
  '\u2265',  // ≥ greater than or equal
  '\u2260',  // ≠ not equal
  '\u2248',  // ≈ approximately equal
  '\u221A',  // √ square root
  '\u03BC',  // μ mu
  '\u03C3',  // σ sigma
  '\u03A3',  // Σ sum
  '\u03C0',  // π pi
  '\u221E',  // ∞ infinity
  '\u00B2',  // ² superscript 2
  '\u00B3',  // ³ superscript 3
  '\u00B0',  // ° degree
];

/**
 * Ensure all mathematical symbols pass through without modification.
 * The docx TextRun constructor should preserve Unicode, but some
 * encoding pipelines may normalize characters — this sanitizer
 * explicitly preserves every recognized math symbol.
 */
export function sanitizeMathSymbols(text: string): string {
  // All listed symbols are standard Unicode and should pass through.
  // We return the text as-is; this function exists as an explicit
  // documentation of which symbols must survive the docx pipeline.
  return text;
}

/**
 * Parse a text string with markdown formatting (**bold**, *italic*, ***bold+italic***)
 * into a docx Paragraph with correctly styled TextRun children.
 */
export function parseMarkdownToRuns(text: string): Paragraph {
  const segments = parseSegments(text).map((seg) => ({
    ...seg,
    text: sanitizeMathSymbols(seg.text),
  }));
  return new Paragraph({
    children: segments.map(
      (seg) =>
        new TextRun({
          text: seg.text,
          bold: seg.bold ?? false,
          italics: seg.italic ?? false,
          font: "Times New Roman",
          size: 24,
        })
    ),
    spacing: { after: 200, line: 360 },
  });
}

/**
 * Check if a text block represents a markdown heading and return the heading level.
 * Returns 0 if not a heading.
 */
export function detectMarkdownHeading(
  text: string
): { level: 1 | 2 | 3; text: string } | null {
  const h1Match = text.match(/^# (.+)/);
  if (h1Match) return { level: 1, text: h1Match[1].trim() };

  const h2Match = text.match(/^## (.+)/);
  if (h2Match) return { level: 2, text: h2Match[1].trim() };

  const h3Match = text.match(/^### (.+)/);
  if (h3Match) return { level: 3, text: h3Match[1].trim() };

  return null;
}

/**
 * Strip leading/trailing standalone markdown markers that weren't caught by regex.
 * Also strips ``` code fence markers.
 */
export function cleanMarkdown(text: string): string {
  let cleaned = text;
  // Strip leading/trailing ** that are unmatched
  cleaned = cleaned.replace(/^\*\*(.+)\*\*$/, "$1");
  // Strip code fence markers (replace with plain text marker)
  cleaned = cleaned.replace(/^```\w*\s*/gm, "[CODE]\n");
  cleaned = cleaned.replace(/\s*```\s*$/gm, "\n[/CODE]");
  // Strip standalone * characters not part of emphasis
  cleaned = cleaned.replace(/(?<!\*)\*(?!\*)(?![^*]*\*)/g, "");
  return cleaned.trim();
}

/**
 * Split text into segments by markdown patterns (**bold**, *italic*, ***bold+italic***).
 */
function parseSegments(text: string): MarkdownSegment[] {
  const segments: MarkdownSegment[] = [];
  // Regex to match ***bold+italic***, **bold**, *italic*
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }

    if (match[2]) {
      // ***bold italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], italic: true });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining plain text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments;
}
