import * as cheerio from "cheerio";
import { SessionManager } from "./session.ts";
import { parseAttendanceMonth } from "./parser.ts";
import type { MonthData } from "./types.ts";
import {readTextFile} from "@tauri-apps/plugin-fs"
import { resolveResource } from "@tauri-apps/api/path";

function getCurrentPeriod() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const monthNum = (now.getMonth() + 1).toString().padStart(2, "0");
  const monthLabel = `${year}-${monthNum}`;
  return {
    year,
    month: monthNum,
    code: `${year}${monthNum}`,
    label: monthLabel,
  };
}
async function fetchStubHtml(group: string, monthCode: string): Promise<string | null> {
  // Задайте базовую директорию, где лежат ваши заглушки.
  // Например, в ресурсах приложения или в app data dir.
  const baseDir = await resolveResource("sd"); // относительно current working dir, или используйте path API

  const pathsToTry = [
    `${baseDir}\\${group}\\${monthCode}.html`,
    `${baseDir}\\${monthCode}.html`,
  ];

  for (const filePath of pathsToTry) {
    try {
      const content = await readTextFile(filePath);
      console.log(`[Attendance] Stub loaded from disk: ${filePath}`);
      return content;
    } catch (error) {
      console.warn(`[Attendance] Stub not found at: ${filePath}`, error);
    }
  }

  return null;
}

function seemsDeniedHtml(html: string): boolean {
  const text = cheerio.load(html)("body").text().toLowerCase();
  return (
    text.includes("доступ") ||
    text.includes("нет прав") ||
    text.includes("авториз") ||
    text.includes("ошибка") ||
    text.includes("не найдена")
  );
}

function isAccessRedirect(res: Response, expectedPathPart: string): boolean {
  if (!res.redirected) return false;

  const url = (res.url || "").toLowerCase();
  const expected = expectedPathPart.toLowerCase();

  if (url.includes(expected)) return false;

  return (
    url.includes("/login") ||
    url.includes("/users/sign_in") ||
    url.includes("/auth") ||
    url.includes("/403") ||
    url.includes("/404") ||
    url.includes("/error")
  );
}

async function loadStubAttendance(group: string, monthCode?: string): Promise<MonthData> {
  console.log(`[Attendance] Переход на заглушку: group=${group}, month=${monthCode ?? "auto"}`);
  const current = getCurrentPeriod();
  const fallbackMonths = ['202602','202603','202604','202605'];
  const candidates = [
    monthCode,
    current.code,
    ...fallbackMonths,
  ].filter((v): v is string => Boolean(v));

  for (const code of candidates) {
    const html = await fetchStubHtml(group, code);
    //console.log(html);
    if (!html) continue;

    const parsed = parseAttendanceMonth(html, group);
    console.log(parsed);
    parsed.month = monthCode ?? code;
    console.log(`[Attendance] Заглушка загружена: group=${group}, sourceMonth=${code}, targetMonth=${parsed.month}`);
    return parsed;
  }

  console.error(`[Attendance] Заглушка не найдена: group=${group}, month=${monthCode ?? "auto"}`);
  throw new Error(`[Attendance] Stub not found for group ${group}`);
}

async function probeMonthCodes(
  group: string,
  year: string,
  month: string,
  session: SessionManager,
): Promise<string[] | null> {
  const monthCode = `${year}${month}`;
  const expectedPath = `/students_groups_card_event/${group}/sd/${monthCode}/`;
  const url = `https://isu.smtu.ru${expectedPath}`;

  try {
    const res = await session.request(url);
    if (!res.ok || res.status === 403 || res.status === 404) throw new Error(`HTTP ${res.status}`);
    if (isAccessRedirect(res, expectedPath)) throw new Error("Redirected to access page");
    const html = await res.text();

    if (seemsDeniedHtml(html)) throw new Error("Access denied by content");

    return null;//extractMonthCodesFromPage(html);
  } catch (error) {
    console.warn(`[Attendance] Не удалось получить список месяцев для ${group}:`, error);
    return null;
  }
}

async function fetchSingleMonth(
  group: string,
  monthCode: string,
  session: SessionManager,
): Promise<MonthData> {
  const expectedPath = `/students_groups_card_event/${group}/sd/${monthCode}/`;
  const url = `https://isu.smtu.ru${expectedPath}`;

  try {
    const res = await session.request(url);
    if (!res.ok || res.status === 403 || res.status === 404) throw new Error(`HTTP ${res.status}`);
    if (isAccessRedirect(res, expectedPath)) throw new Error("Redirected to access page");
    const html = await res.text();

    if (seemsDeniedHtml(html)) throw new Error("Access denied by content");

    const parsed = parseAttendanceMonth(html, group);
    parsed.month = monthCode;
    console.log(`[Attendance] Данные загружены онлайн: group=${group}, month=${monthCode}`);
    return parsed;
  } catch (error) {
    console.warn(`[Attendance] Онлайн-загрузка не удалась, использую заглушку: group=${group}, month=${monthCode}`, error);
    return loadStubAttendance(group, monthCode);
  }
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number,
): Promise<Array<T | undefined>> {
  const results: Array<T | undefined> = new Array(tasks.length).fill(undefined);
  const queue = tasks.map((task, i) => ({ task, i }));

  const workers = Array.from({ length: limit }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) break;

      try {
        results[next.i] = await next.task();
      } catch {
        // no-op, fallback is handled in fetchSingleMonth
      }
    }
  });

  await Promise.all(workers);
  return results;
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export async function fetchAttendanceForGroups(
  groups: string[],
  session: SessionManager,
  options: { concurrency?: number; delay?: number; stubOnly?: boolean } = {},
): Promise<MonthData[]> {
  const { concurrency = 4, delay = 200, stubOnly = false } = options;
  const current = getCurrentPeriod();

  console.log(`[Attendance] fetchAttendanceForGroups() start`);
  console.log(`[Attendance] Текущий период: ${current.label} (${current.code})`);
  console.log(`[Attendance] Пробуем получить список месяцев для ${groups.length} групп...`);

  const groupMonths: Record<string, string[]> = {};

  for (const group of groups) {
    const stubMonthCodes = ['202602','202603','202604','202605'];
    const monthCodes = stubOnly
      ? null
      : await probeMonthCodes(group, current.year, current.month, session);

    groupMonths[group] = monthCodes && monthCodes.length > 0
      ? monthCodes
      : stubMonthCodes.length > 0
        ? stubMonthCodes
        : [current.code];
    console.log(`[Attendance] ${group}: месяцев к загрузке ${groupMonths[group].length} -> ${groupMonths[group].join(", ")}`);
  }

  const allTasks: Array<() => Promise<MonthData>> = [];

  for (const group of groups) {
    for (const monthCode of groupMonths[group]) {
      allTasks.push(async () => {
        if (delay > 0) await new Promise((r) => setTimeout(r, delay));
        if (stubOnly) return loadStubAttendance(group, monthCode);
        return fetchSingleMonth(group, monthCode, session);
      });
    }
  }

  if (allTasks.length === 0) return [];

  const loaded = (await runWithConcurrency(allTasks, concurrency)).filter(isDefined);
  console.log(`[Attendance] Загрузка завершена. Записей месяцев: ${loaded.length}`);
  return loaded;
}
