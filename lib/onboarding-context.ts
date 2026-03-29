import type { PlaceDetailsResult } from "@/lib/google-places";

export type OnboardingQa = {
  special?: string;
  story?: string;
  regulars?: string;
  insider?: string;
};

export function buildBarContextForClaude(params: {
  place: PlaceDetailsResult;
  qa: OnboardingQa;
}): string {
  const p = params.place;
  const lines: string[] = [
    `Name: ${p.name}`,
    `Address: ${p.formatted_address}`,
  ];
  if (p.website) lines.push(`Website: ${p.website}`);
  if (p.formatted_phone_number || p.international_phone_number) {
    lines.push(
      `Phone: ${p.formatted_phone_number ?? p.international_phone_number}`
    );
  }
  if (p.types?.length) {
    lines.push(`Types: ${p.types.join(", ")}`);
  }
  if (p.price_level != null) {
    lines.push(`Price level (0–4): ${p.price_level}`);
  }
  if (p.opening_hours?.weekday_text?.length) {
    lines.push(`Hours:\n${p.opening_hours.weekday_text.join("\n")}`);
  }
  if (p.editorial_summary?.overview) {
    lines.push(`Google summary: ${p.editorial_summary.overview}`);
  }
  const { qa } = params;
  if (qa.special?.trim()) lines.push(`What makes it special: ${qa.special.trim()}`);
  if (qa.story?.trim()) lines.push(`Name/location story: ${qa.story.trim()}`);
  if (qa.regulars?.trim()) lines.push(`Regulars order: ${qa.regulars.trim()}`);
  if (qa.insider?.trim()) lines.push(`Insider tip: ${qa.insider.trim()}`);
  return lines.join("\n");
}

export function buildPrizeDescription(params: {
  place: PlaceDetailsResult;
  qa: OnboardingQa;
}): string {
  const blocks: string[] = [];
  if (params.place.website) {
    blocks.push(`Website: ${params.place.website}`);
  }
  if (
    params.place.formatted_phone_number ||
    params.place.international_phone_number
  ) {
    blocks.push(
      `Phone: ${params.place.formatted_phone_number ?? params.place.international_phone_number}`
    );
  }
  if (params.place.editorial_summary?.overview) {
    blocks.push(`About: ${params.place.editorial_summary.overview}`);
  }
  const { qa } = params;
  if (qa.special?.trim()) blocks.push(`Special: ${qa.special.trim()}`);
  if (qa.story?.trim()) blocks.push(`Story: ${qa.story.trim()}`);
  if (qa.regulars?.trim()) blocks.push(`Regulars order: ${qa.regulars.trim()}`);
  if (qa.insider?.trim()) blocks.push(`Insider: ${qa.insider.trim()}`);
  return blocks.join("\n\n");
}
