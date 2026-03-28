import type { GroupLanguage } from "@/lib/types";

/** Filter route to bars that exist and are active. Preserves order. */
export function filterActiveRoute(
  route: string[],
  activeBarIds: Set<string>
): string[] {
  return route.filter((id) => activeBarIds.has(id));
}

export function parseLanguageInput(text: string): GroupLanguage | null {
  const t = text.trim().toLowerCase();
  if (
    t === "en" ||
    t === "english" ||
    t.startsWith("engl") ||
    t === "e"
  ) {
    return "en";
  }
  if (
    t === "de" ||
    t === "deutsch" ||
    t === "german" ||
    t.startsWith("deut") ||
    t === "d"
  ) {
    return "de";
  }
  return null;
}

const TIME_BONUS_WINDOW_MS = 5 * 60 * 1000;
const TIME_BONUS_MAX = 50;

export function computeTimeBonus(now: Date, startedAt: Date | null): number {
  if (!startedAt) return 0;
  const elapsed = now.getTime() - startedAt.getTime();
  if (elapsed >= TIME_BONUS_WINDOW_MS) return 0;
  const minutesLeft = (TIME_BONUS_WINDOW_MS - elapsed) / 60_000;
  return Math.min(TIME_BONUS_MAX, Math.max(0, Math.floor(minutesLeft)));
}

export function barPointsForSolve(hintsDelivered: number): {
  base: number;
  hintPenalty: number;
} {
  const base = 100;
  const hintPenalty = 10 * Math.min(2, Math.max(0, hintsDelivered));
  return { base, hintPenalty };
}
