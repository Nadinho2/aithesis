import { createServerFn } from "@tanstack/react-start";

export const PRICING = {
  topics: { label: "Topic Discovery", price: 0, currency: "NGN" },
  proposal: { label: "Research Proposal", price: 5000, currency: "NGN" },
  thesis: {
    undergraduate: { label: "Undergraduate Thesis", price: 20000, currency: "NGN" },
    masters: { label: "Masters Thesis", price: 40000, currency: "NGN" },
    phd: { label: "PhD Thesis", price: 50000, currency: "NGN" },
  },
  assignment: { label: "Assignment Assistant", price: 1000, currency: "NGN" },
  exam: { label: "Exam Preparation", price: 1000, currency: "NGN" },
  presentation: { label: "Presentation Assistant", price: 3000, currency: "NGN" },
  cv: { label: "CV Maker", price: 3000, currency: "NGN" },
  seminar_journal: { label: "Journal / Conference Paper", price: 3500, currency: "NGN" },
  seminar_departmental: { label: "Departmental Seminar Paper", price: 2000, currency: "NGN" },
  seminar_postgraduate: { label: "Postgraduate Research Seminar", price: 2500, currency: "NGN" },
  seminar_technical: { label: "Technical / Engineering Seminar", price: 2500, currency: "NGN" },
  seminar_book_review: { label: "Book Review Seminar", price: 1500, currency: "NGN" },
} as const;

export type ProductType = "proposal" | "thesis" | "assignment" | "exam" | "presentation" | "cv" | "seminar_journal" | "seminar_departmental" | "seminar_postgraduate" | "seminar_technical" | "seminar_book_review";
export type ThesisLevel = "undergraduate" | "masters" | "phd";

export function getPrice(product: ProductType, level?: ThesisLevel): number {
  if (product === "thesis" && level) return PRICING.thesis[level].price;
  if (product in PRICING) {
    const p = (PRICING as any)[product];
    if (p && typeof p === "object" && "price" in p) return p.price;
  }
  return 0;
}

export function getLabel(product: ProductType, level?: ThesisLevel): string {
  if (product === "thesis" && level) return PRICING.thesis[level].label;
  if (product in PRICING) {
    const p = (PRICING as any)[product];
    if (p && typeof p === "object" && "label" in p) return p.label;
  }
  return "";
}

/** Map a seminar_type to its human-readable label */
export function seminarTypeLabel(type: string): string {
  const map: Record<string, string> = {
    seminar_journal: "Journal Paper",
    seminar_departmental: "Departmental Seminar",
    seminar_postgraduate: "Postgraduate Seminar",
    seminar_technical: "Technical Seminar",
    seminar_book_review: "Book Review",
  };
  return map[type] ?? type;
}

// ═══════════════════════════════════════════════════════════
// DB-backed pricing — reads from Supabase settings table,
// falls back to hardcoded PRICING defaults if DB is unreachable
// ═══════════════════════════════════════════════════════════

let _cachedPrices: Record<string, { label: string; price: number; currency: string }> | null = null;
let _cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function runtimeEnvPricing(key: string): string | undefined {
  try { return (globalThis as any).process?.env?.[key]; } catch { return undefined; }
}

async function loadPricesFromDB(): Promise<Record<string, any>> {
  const url = runtimeEnvPricing("SUPABASE_URL");
  const key = runtimeEnvPricing("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return {};

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await (supabase as any)
      .from("settings")
      .select("key,value")
      .like("key", "price:%");

    if (error || !data) return {};
    const map: Record<string, any> = {};
    for (const row of data) map[row.key] = row.value;
    return map;
  } catch {
    return {};
  }
}

function buildFallbackMap(): Record<string, { label: string; price: number; currency: string }> {
  const map: Record<string, { label: string; price: number; currency: string }> = {};
  map["price:proposal"] = { ...PRICING.proposal };
  for (const [level, entry] of Object.entries(PRICING.thesis)) {
    map[`price:thesis:${level}`] = { ...entry };
  }
  const simpleKeys: Record<string, keyof typeof PRICING> = {
    "price:assignment": "assignment",
    "price:exam": "exam",
    "price:presentation": "presentation",
    "price:cv": "cv",
  };
  for (const [k, pk] of Object.entries(simpleKeys)) {
    const p = PRICING[pk] as any;
    map[k] = { label: p.label, price: p.price, currency: p.currency };
  }
  for (const sk of ["seminar_journal", "seminar_departmental", "seminar_postgraduate", "seminar_technical", "seminar_book_review"]) {
    const p = PRICING[sk as keyof typeof PRICING] as any;
    map[`price:${sk}`] = { label: p.label, price: p.price, currency: p.currency };
  }
  return map;
}

async function getPriceMap(): Promise<Record<string, { label: string; price: number; currency: string }>> {
  const now = Date.now();
  if (_cachedPrices && now - _cacheTime < CACHE_TTL) return _cachedPrices;

  const dbPrices = await loadPricesFromDB();
  const fallback = buildFallbackMap();

  // Merge: DB overrides fallback
  const merged: Record<string, { label: string; price: number; currency: string }> = { ...fallback };
  for (const [key, val] of Object.entries(dbPrices)) {
    if (val && typeof val === "object" && typeof val.price === "number") {
      merged[key] = { label: val.label ?? merged[key]?.label ?? "", price: val.price, currency: val.currency ?? "NGN" };
    }
  }

  _cachedPrices = merged;
  _cacheTime = now;
  return merged;
}

/** Get price from DB (with 5-min cache), falling back to hardcoded PRICING */
export async function getPriceFromDB(product: ProductType, level?: ThesisLevel): Promise<number> {
  const key = product === "thesis" && level ? `price:thesis:${level}` : `price:${product}`;
  const map = await getPriceMap();
  return map[key]?.price ?? getPrice(product, level);
}

/** Get all prices (React Server Components / server-side use) */
export async function getAllPrices(): Promise<Record<string, { label: string; price: number; currency: string }>> {
  return getPriceMap();
}

// ═══════════════════════════════════════════════════════════
// Server function for client-side price fetching
// ═══════════════════════════════════════════════════════════

export const fetchAllPrices = createServerFn({ method: "GET" })
  .handler(async () => {
    return getAllPrices();
  });