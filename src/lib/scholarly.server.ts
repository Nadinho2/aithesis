// Multi-source scholarly reference fetcher.
// Free APIs (no key): OpenAlex, Crossref, Google Scholar (via Semantic Scholar), arXiv.

export type ScholarlyRef = {
  source: "openalex" | "crossref" | "google_scholar" | "arxiv";
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  url: string | null;
  abstract: string | null;
  citation_count: number | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
};

const UA = "ThesisProAI/1.0 (mailto:research@thesispro.ai)";

async function safe<T>(p: Promise<T>): Promise<T | null> {
  try { return await p; } catch { return null; }
}

async function openAlex(q: string, n: number): Promise<ScholarlyRef[]> {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=${n}&sort=relevance_score:desc`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j.results ?? []).map((w: any) => ({
    source: "openalex" as const,
    title: w.title ?? "",
    authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
    year: w.publication_year ?? null,
    venue: w.host_venue?.display_name ?? w.primary_location?.source?.display_name ?? null,
    doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
    url: w.doi ?? w.primary_location?.landing_page_url ?? null,
    abstract: w.abstract_inverted_index ? invertedToText(w.abstract_inverted_index).slice(0, 600) : null,
    citation_count: w.cited_by_count ?? null,
    volume: w.biblio?.volume ?? null,
    issue: w.biblio?.issue ?? null,
    pages: w.biblio?.first_page && w.biblio?.last_page ? `${w.biblio.first_page}–${w.biblio.last_page}` : null,
  }));
}

function invertedToText(idx: Record<string, number[]>): string {
  const words: string[] = [];
  for (const [w, positions] of Object.entries(idx)) for (const p of positions) words[p] = w;
  return words.filter(Boolean).join(" ");
}

async function crossref(q: string, n: number): Promise<ScholarlyRef[]> {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&rows=${n}&select=DOI,title,author,issued,container-title,abstract,is-referenced-by-count,URL,volume,issue,page`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j.message?.items ?? []).map((it: any) => ({
    source: "crossref" as const,
    title: Array.isArray(it.title) ? it.title[0] : it.title ?? "",
    authors: (it.author ?? []).map((a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim()),
    year: it.issued?.["date-parts"]?.[0]?.[0] ?? null,
    venue: Array.isArray(it["container-title"]) ? it["container-title"][0] : null,
    doi: it.DOI ?? null,
    url: it.URL ?? (it.DOI ? `https://doi.org/${it.DOI}` : null),
    abstract: it.abstract ? String(it.abstract).replace(/<[^>]+>/g, "").slice(0, 600) : null,
    citation_count: it["is-referenced-by-count"] ?? null,
    volume: it.volume ?? null,
    issue: it.issue ?? null,
    pages: it.page ?? null,
  }));
}

async function googleScholar(q: string, n: number): Promise<ScholarlyRef[]> {
  // Google Scholar has no free API. We query Semantic Scholar — its corpus covers the
  // same peer-reviewed literature (IEEE, Springer, Elsevier, ACM, etc.) indexed by Google Scholar.
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${n}&fields=title,authors,year,venue,abstract,citationCount,externalIds,url,journal`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const j: any = await r.json();
  return (j.data ?? []).map((p: any) => ({
    source: "google_scholar" as const,
    title: p.title ?? "",
    authors: (p.authors ?? []).map((a: any) => a.name).filter(Boolean),
    year: p.year ?? null,
    venue: p.venue ?? p.journal?.name ?? null,
    doi: p.externalIds?.DOI ?? null,
    url: p.url ?? (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : null),
    abstract: p.abstract ? String(p.abstract).slice(0, 600) : null,
    citation_count: p.citationCount ?? null,
    volume: p.journal?.volume ?? null,
    issue: null,
    pages: p.journal?.pages ?? null,
  }));
}

async function arxiv(q: string, n: number): Promise<ScholarlyRef[]> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&start=0&max_results=${n}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) return [];
  const xml = await r.text();
  const entries = xml.split("<entry>").slice(1);
  return entries.map((block) => {
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : "";
    };
    const authors = [...block.matchAll(/<name>([\s\S]*?)<\/name>/g)].map((m) => m[1].trim());
    const published = get("published");
    const id = get("id");
    return {
      source: "arxiv" as const,
      title: get("title").replace(/\s+/g, " "),
      authors,
      year: published ? Number(published.slice(0, 4)) : null,
      venue: "arXiv preprint",
      doi: null,
      url: id || null,
      abstract: get("summary").replace(/\s+/g, " ").slice(0, 600),
      citation_count: null,
      volume: null,
      issue: null,
      pages: null,
    };
  });
}

export async function fetchScholarlyRefs(query: string, perSource = 6): Promise<ScholarlyRef[]> {
  const [a, b, c, d] = await Promise.all([
    safe(openAlex(query, perSource)),
    safe(crossref(query, perSource)),
    safe(googleScholar(query, perSource)),
    safe(arxiv(query, perSource)),
  ]);
  const all = [...(a ?? []), ...(b ?? []), ...(c ?? []), ...(d ?? [])];
  const seen = new Set<string>();
  const out: ScholarlyRef[] = [];
  for (const ref of all) {
    if (!ref.title) continue;
    const key = (ref.doi ?? ref.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()).slice(0, 120);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(ref);
  }
  out.sort((x, y) => {
    const sx = (x.abstract ? 3 : 0) + Math.min((x.citation_count ?? 0) / 50, 5) + ((x.year ?? 0) >= 2018 ? 2 : 0);
    const sy = (y.abstract ? 3 : 0) + Math.min((y.citation_count ?? 0) / 50, 5) + ((y.year ?? 0) >= 2018 ? 2 : 0);
    return sy - sx;
  });
  return out.slice(0, 30);
}

// APA 7th edition formatter.
// Authors: Last, F. M., Last, F. M., & Last, F. M.
// Up to 20 authors listed; >20 → first 19, ellipsis, then last.
function formatAuthorAPA(full: string): string {
  const cleaned = full.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  // Handle "Last, First" already-comma form
  if (cleaned.includes(",")) {
    const [last, rest] = cleaned.split(",").map((s) => s.trim());
    const initials = rest
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0]?.toUpperCase() + ".")
      .join(" ");
    return `${last}, ${initials}`.trim();
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => p[0]?.toUpperCase() + ".").join(" ");
  return `${last}, ${initials}`;
}

function authorsAPA(authors: string[]): string {
  const cleaned = authors.map(formatAuthorAPA).filter(Boolean);
  if (cleaned.length === 0) return "";
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length <= 20) {
    return cleaned.slice(0, -1).join(", ") + ", & " + cleaned[cleaned.length - 1];
  }
  return cleaned.slice(0, 19).join(", ") + ", . . . " + cleaned[cleaned.length - 1];
}

// Title case for journals/books; sentence case for article titles per APA 7.
function sentenceCase(t: string): string {
  const s = t.trim().replace(/\s+/g, " ");
  if (!s) return s;
  return s[0].toUpperCase() + s.slice(1).toLowerCase().replace(/(:\s+|\?\s+|\.\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
}

export function formatAPA(ref: ScholarlyRef): string {
  const authors = authorsAPA(ref.authors) || "Unknown Author";
  const year = ref.year ? `(${ref.year})` : "(n.d.)";
  const title = sentenceCase(ref.title).replace(/\.$/, "") + ".";
  let venue = "";
  if (ref.venue) {
    venue = ref.venue.trim();
    if (ref.volume) {
      venue += `, ${ref.volume}`;
      if (ref.issue) venue += `(${ref.issue})`;
    }
    if (ref.pages) venue += `, ${ref.pages}`;
    venue += ".";
  }
  const link = ref.doi ? `https://doi.org/${ref.doi}` : ref.url ?? "";
  return [`${authors} ${year}.`, title, venue, link].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

// Structured APA 7 segments for rich rendering (e.g. italicized journal in DOCX).
export function formatAPAParts(ref: ScholarlyRef): {
  authorsYear: string;
  title: string;
  venueItalic: string;
  venueTail: string;
  url: string;
} {
  const authors = authorsAPA(ref.authors) || "Unknown Author";
  const year = ref.year ? `(${ref.year})` : "(n.d.)";
  const title = sentenceCase(ref.title).replace(/\.$/, "") + ".";
  let venueItalic = "";
  let venueTail = "";
  if (ref.venue) {
    venueItalic = ref.venue.trim();
    if (ref.volume) {
      venueItalic += `, ${ref.volume}`;
    }
    if (ref.issue) venueTail += `(${ref.issue})`;
    if (ref.pages) venueTail += `, ${ref.pages}`;
    venueTail += ".";
  }
  const url = ref.doi ? `https://doi.org/${ref.doi}` : ref.url ?? "";
  return { authorsYear: `${authors} ${year}.`, title, venueItalic, venueTail, url };
}
