import type { MonthData } from "../types.ts";

const SPRING_MONTH_CODES = new Set(["02", "03", "04", "05"]);
const AUTUMN_MONTH_CODES = new Set(["09", "10", "11", "12"]);

function extractMonthCode(label: string): string | null {
  const direct = label.match(/\b20\d{2}(0[1-9]|1[0-2])\b/);
  if (direct) return direct[0].slice(4, 6);
  return null;
}

function getCurrentSemesterCodeSet(): Set<string> {
  const monthIdx = new Date().getMonth() + 1;

  if (monthIdx >= 2 && monthIdx <= 5) return SPRING_MONTH_CODES;
  if (monthIdx >= 9 && monthIdx <= 12) return AUTUMN_MONTH_CODES;
  if (monthIdx === 1) return AUTUMN_MONTH_CODES;
  return SPRING_MONTH_CODES;
}

export function filterByCurrentSemester(data: MonthData[]): MonthData[] {
  const valid = getCurrentSemesterCodeSet();
  return data.filter((md) => {
    const code = extractMonthCode(md.month);
    return code ? valid.has(code) : false;
  });
}
