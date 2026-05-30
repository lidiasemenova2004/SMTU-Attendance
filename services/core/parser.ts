import * as cheerio from "cheerio";
//import type { Element } from 'cheerio';
import { Element } from 'domhandler';
import type { AttendanceRecord, MonthData } from "./types.ts";

const MONTH_CODE_RE = /\b(20\d{2}(0[1-9]|1[0-2]))\b/;

function parseAttendanceCell(value: string): { present: boolean; timeIn?: string; timeOut?: string } {
  const trimmed = value.trim();
  if (!trimmed || trimmed === "/") return { present: false };

  const match = trimmed.match(/(?:(\d{2}:\d{2}))?\s*\/\s*(?:(\d{2}:\d{2}))?/);
  console.log(match);
  if (match) {
    return { present: true, timeIn: match[1] || undefined, timeOut: match[2] || undefined };
  }
  return { present: true };
}

function extractMonth(html: string): string {
  const code = html.match(MONTH_CODE_RE);
  if (code) return code[1];

  const bodyText = cheerio.load(html)("body").text();
  const codeFromText = bodyText.match(MONTH_CODE_RE);
  return codeFromText ? codeFromText[1] : "Unknown";
}

export function parseAttendanceMonth(html: string, group: string): MonthData {
  const $ = cheerio.load(html);
  const month = extractMonth(html);

  const records: AttendanceRecord[] = [];
  const dates: { date: string; day: string }[] = [];

  const tables = $("table").toArray() as Element[]; 
  const tableNode = tables.find((tbl) => { 
    const headerCells = $(tbl).find("tr").first().find("th, td").length;
    return headerCells >= 3;
  });

  console.log(tableNode);
  if (!tableNode) throw new Error(`Attendance table not found for group ${group}`);
  const table = $(tableNode);

  const rows = table.find("tr");
  let headerRow: any = null;
  rows.each((_idx: number, row: Element) => {
    const cells = $(row).find("th, td");
    if (cells.length < 3) return;

    for (let i = 2; i < Math.min(cells.length, 6); i++) {
      const cellText = $(cells[i]).text().trim();

      if (/^\d{1,2}[А-Яа-яёЁ]{2,3}$/.test(cellText)) {
        headerRow = $(row);
        return false;
      }
    }
  });
  if (!headerRow) {
    console.error('[ERROR] Could not find header row. Sample cells:');

    throw new Error("Could not find header row with dates");
  }
  headerRow!.find("th, td").each((i: number, el: Element) => {
    if (i < 2) return;
    const txt = $(el).text().trim();

    const m = txt.match(/^(\d{1,2})([А-Яа-яёЁ]{2,3})$/);
    if (m) {
      console.log(`[DATE] Parsed: "${txt}" → ${m[1]} ${m[2]}`);
      dates.push({ date: m[1], day: m[2] });
    } else {
      console.log(`[SKIP] "${txt}" doesn't match date pattern`);
    }
  });

  table.find("tr").each((_idx: number, row: Element) => {
    const $row = $(row);

    if (headerRow && $row[0] === headerRow[0]) return;

    const cols = $row.find("td").map((_: number, td: Element) => $(td).text().trim()).toArray();

    if (cols.length < dates.length + 2) return;

    const studentNumber = parseInt(cols[0], 10);
    if (isNaN(studentNumber) || studentNumber <= 0) return;

    const fio = cols[1];
    const isDateLike = /^\d{1,2}[А-Яа-яёЁ]{2,3}$/.test(fio); // "01Вс"
    const looksLikeName = /[а-яё]/i.test(fio) && fio.length > 4 && !/^\d/.test(fio);

    if (!fio || isDateLike || !looksLikeName) return;

    for (let i = 0; i < dates.length; i++) {
      const cell = cols[i + 2] || "";
      const { present, timeIn, timeOut } = parseAttendanceCell(cell);
      records.push({
        studentNumber,
        fio,
        date: dates[i].date,
        dayOfWeek: dates[i].day,
        timeIn,
        timeOut,
        present,
      });
    }
  });

  return { group, month, records };
}
