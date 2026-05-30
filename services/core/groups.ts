import { SessionManager } from "./session.ts";
import { buildGroupSchedule } from "./schedule/schedule.ts";
//import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { Lesson } from "./schedule/schedule.ts";

export type GroupScheduleLesson = Lesson & {
  dayIndex: number;
};

// Кэш для расписания
let cachedSchedulePromise: Promise<Awaited<ReturnType<typeof buildGroupSchedule>>> | null = null;

/**
 * Внутренняя функция для получения расписания с кэшированием.
 * При первом вызове загружает данные, при повторных возвращает сохранённый Promise.
 */
async function getCachedSchedule(
  session: SessionManager,
  onProgress?: (pct: number) => void
): Promise<Awaited<ReturnType<typeof buildGroupSchedule>>> {
  if (!cachedSchedulePromise) {
    cachedSchedulePromise = buildGroupSchedule(session.request.bind(session), { onProgress });
  }
  return cachedSchedulePromise;
}

/**
 * Возвращает словарь групп с отсортированными списками предметов.
 * Теперь принимает session и опционально onProgress.
 */
export async function fetchGroupsAndSubjects(
  session: SessionManager,
  options?: { onProgress?: (pct: number) => void }
): Promise<Record<string, string[]>> {
  const schedule = await getCachedSchedule(session, options?.onProgress);
  const index: Record<string, Set<string>> = {};

  for (const [group, ...days] of schedule) {
    index[group] ??= new Set<string>();
    for (const dayLessons of days) {
      for (const lesson of dayLessons) {
        index[group].add(lesson.subject);
      }
    }
  }
  return Object.fromEntries(
    Object.entries(index).map(([g, s]) => [g, Array.from(s).sort()])
  );
}

/**
 * Возвращает отсортированный список групп, соответствующих шаблону /^20\d{3}/.
 */
export async function fetchTargetGroups(session: SessionManager): Promise<string[]> {
  const schedule = await getCachedSchedule(session);
  const allGroups = schedule.map(([group]) => group);

  return allGroups
    .filter((group) => /^20\d{3}/.test(group))
    .sort((a, b) => a.localeCompare(b));
}

/**
 * Возвращает расписание в виде плоского списка уроков для каждой группы.
 */
export async function fetchGroupScheduleLessons(
  session: SessionManager
): Promise<Record<string, GroupScheduleLesson[]>> {
  const schedule = await getCachedSchedule(session);
  const result: Record<string, GroupScheduleLesson[]> = {};

  for (const [group, ...days] of schedule) {
    if (!/^20\d{3}/.test(group)) continue;
    const lessons: GroupScheduleLesson[] = [];

    days.forEach((dayLessons, dayIndex) => {
      for (const lesson of dayLessons) {
        lessons.push({
          ...lesson,
          dayIndex,
        });
      }
    });

    result[group] = lessons;
  }

  return result;
}