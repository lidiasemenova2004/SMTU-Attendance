import { setPipelineData } from "./utils/saver.ts";
import { SessionManager } from "./session.ts";
import { loginISU } from "./auth.ts";
import { fetchGroupScheduleLessons, fetchTargetGroups } from "./groups.ts";
import { fetchAttendanceForGroups } from "./attendance.ts";
import { calculateStats, buildDashboardDataExtended } from "./stats.ts";
import { filterByCurrentSemester } from "./utils/semester.ts";
import type { PipelineResult } from "./types.ts";

const RUSSIAN_HOLIDAYS = [
  "2025-11-04",
  "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08",
  "2026-02-23",
  "2026-03-08",
  "2026-05-01",
  "2026-05-09",
];

export async function runFullPipeline(
  email: string,
  password: string,
  onProgress?: (step: string) => void,
  options: { stubOnly?: boolean } = {},
): Promise<PipelineResult> {
  const { stubOnly = false } = options;
  const session = new SessionManager();

  if (!stubOnly) {
    onProgress?.("Авторизация в ИСУ...");
    await loginISU(email, password, session);
  } else {
    onProgress?.("Режим заглушек: авторизация пропущена");
  }

  onProgress?.("Загрузка расписания...");
  const targetGroups = await fetchTargetGroups(session);
  const groupScheduleLessons = await fetchGroupScheduleLessons(session);
  console.log(`Найдено групп: ${targetGroups.length}`);

  onProgress?.("Сбор данных посещаемости...");
  const allMonthData = await fetchAttendanceForGroups(targetGroups, session, {
    concurrency: 4,
    delay: 250,
    stubOnly,
  });

  onProgress?.("Фильтрация по семестру...");
  const semesterData = filterByCurrentSemester(allMonthData);
  const effectiveData = semesterData.length > 0 ? semesterData : allMonthData;

  onProgress?.("Расчёт статистики...");
  const stats = calculateStats(effectiveData);
  const dashboardDatas = buildDashboardDataExtended(
    stats,
    effectiveData,
    groupScheduleLessons,
    "2025-09-01",
    RUSSIAN_HOLIDAYS // дата начала семестра (можно вынести в настройки)
  );

  onProgress?.("Сохранение результата...");
const result = {
  groups: targetGroups,
  dashboardDatas
};

  setPipelineData(result);

  onProgress?.("Готово");
  return result;
}
