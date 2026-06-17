export const PRICING = {
  topics: { label: "Topic Discovery", price: 0, currency: "NGN" },
  proposal: { label: "Research Proposal", price: 2000, currency: "NGN" },
  thesis: {
    undergraduate: { label: "Undergraduate Thesis", price: 20000, currency: "NGN" },
    masters: { label: "Masters Thesis", price: 40000, currency: "NGN" },
    phd: { label: "PhD Thesis", price: 50000, currency: "NGN" },
  },
} as const;

export type ProductType = "proposal" | "thesis";
export type ThesisLevel = "undergraduate" | "masters" | "phd";

export function getPrice(product: ProductType, level?: ThesisLevel): number {
  if (product === "proposal") return PRICING.proposal.price;
  if (product === "thesis" && level) return PRICING.thesis[level].price;
  return 0;
}

export function getLabel(product: ProductType, level?: ThesisLevel): string {
  if (product === "proposal") return PRICING.proposal.label;
  if (product === "thesis" && level) return PRICING.thesis[level].label;
  return "";
}
