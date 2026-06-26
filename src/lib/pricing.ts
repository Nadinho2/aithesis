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
} as const;

export type ProductType = "proposal" | "thesis" | "assignment" | "exam" | "presentation" | "cv";
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
