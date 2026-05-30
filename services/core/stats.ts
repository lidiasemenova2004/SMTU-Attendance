import type { MonthData, GroupStats, StudentStat } from "./types.ts";
import type { AttendanceRecord } from "./types.ts";
//import type { AttendanceDashboardData } from "../../views/dashboards.ts";
import type { GroupScheduleLesson } from "./groups.ts";
import type { ExtendedAttendanceDashboardData, SubjectSummary, StudentSubjectRow, DaySubjectDetail } from "./types.ts";

function statusByPercent(value: number): string {
  if (value >= 85) return "Отлично";
  if (value >= 70) return "Хорошо";
  if (value >= 50) return "Удовлетворительно";
  return "Требует внимания";
}

function normalizeDate(d: string): string {
  return String(d).padStart(2, "0");
}

function buildDayList(records: AttendanceRecord[]): { key: string; label: string }[] {
  const map = new Map<string, string>();
  for (const r of records) {
    const k = normalizeDate(r.date);
    if (!map.has(k)) map.set(k, r.dayOfWeek); // берём день недели из первой записи
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([key, day]) => ({ key, label: `${key} ${day}` }));
}

function buildStudentRows(
  students: StudentStat[],
  records: AttendanceRecord[],
  dayListFull: { key: string; label: string }[],
): { name: string; days: string[] }[] {
  const studentDays = new Map<string, Map<string, AttendanceRecord>>();

  for (const r of records) {
    const k = normalizeDate(r.date);
    if (!studentDays.has(r.fio)) studentDays.set(r.fio, new Map());
    const dMap = studentDays.get(r.fio)!;
    if (!dMap.has(k)) dMap.set(k, r); // сохраняем первую запись за день
  }

  return students.map((s) => {
    const sMap = studentDays.get(s.fio) ?? new Map();
    const days = dayListFull.map(({ key }) => {
      const rec = sMap.get(key);
      if (!rec || !rec.present) return "-";
      const timeIn = rec.timeIn?.slice(0, 5) ?? "";
      const timeOut = rec.timeOut?.slice(0, 5) ?? "";
      return timeIn && timeOut ? `${timeIn}<br />${timeOut}` : `${timeIn}<br />-` || `-<br />${timeOut}` || "-";
    });
    return { name: s.fio, days };
  });
}

function getWeekParity(dateStr: string, referenceDate: string): "up" | "down" {
  const target = new Date(dateStr);
  const ref = new Date(referenceDate);
  const diffWeeks = Math.floor((target.getTime() - ref.getTime()) / (7 * 24 * 60 * 60 * 1000));
  return diffWeeks % 2 === 0 ? "up" : "down";
}

function toMinutes(hhmm?: string): number | null {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function overlapsByTime(
  timeIn?: string,
  timeOut?: string,
  lessonStart?: string,
  lessonEnd?: string,
): boolean {
  const inMin = toMinutes(timeIn);
  const outMin = toMinutes(timeOut);
  const startMin = toMinutes(lessonStart);
  const endMin = toMinutes(lessonEnd);

  if (inMin === null || outMin === null || startMin === null || endMin === null) return false;
  return inMin < endMin && outMin > startMin;
}

export function calculateStats(allMonthData: MonthData[]): GroupStats[] {
  const result: GroupStats[] = [];

  for (const md of allMonthData) {
    const dayPresenceByStudent = new Map<string, Map<string, boolean>>();

    for (const rec of md.records) {
      if (!dayPresenceByStudent.has(rec.fio)) {
        dayPresenceByStudent.set(rec.fio, new Map<string, boolean>());
      }

      const dayMap = dayPresenceByStudent.get(rec.fio);
      if (!dayMap) continue;

      const prev = dayMap.get(rec.date) ?? false;
      dayMap.set(rec.date, prev || rec.present);
    }

    const students: StudentStat[] = Array.from(dayPresenceByStudent.entries()).map(([fio, dayMap]) => {
      const totalDays = dayMap.size;
      const presentDays = Array.from(dayMap.values()).filter(Boolean).length;
      const absentDays = totalDays - presentDays;
      const attendancePercent = totalDays ? Math.round((presentDays / totalDays) * 100) : 0;

      return { fio, totalDays, presentDays, absentDays, attendancePercent };
    });

    students.sort((a, b) => a.fio.localeCompare(b.fio));

    const groupAvg = students.length
      ? Math.round(students.reduce((sum, s) => sum + s.attendancePercent, 0) / students.length)
      : 0;

    result.push({ group: md.group, month: md.month, students, groupAverage: groupAvg });
  }

  return result;
}
// Получить список учебных дней месяца (без воскресений)
function getMonthCalendar(
  monthStr: string,
  semesterStart: string,
  holidays: Set<string>, // <-- новый параметр
): { date: string; dayIndex: number; weekParity: "up" | "down" }[] {
  const year = parseInt(monthStr.slice(0, 4));
  const month = parseInt(monthStr.slice(4, 6));
  const daysInMonth = new Date(year, month, 0).getDate();
  const result: { date: string; dayIndex: number; weekParity: "up" | "down" }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0) continue; // воскресенье всегда выходной

    const dateIso = dateObj.toISOString().slice(0, 10);
    if (holidays.has(dateIso)) continue; // праздник – пропускаем

    const dayIndex = dayOfWeek - 1;
    const parity = getWeekParity(dateIso, semesterStart);

    result.push({
      date: d.toString().padStart(2, "0"),
      dayIndex,
      weekParity: parity,
    });
  }
  return result;
}

export function buildDashboardDataExtended(
  stats: GroupStats[],
  allMonthData: MonthData[],
  groupScheduleLessons: Record<string, GroupScheduleLesson[]> = {},
  semesterStart: string = "2025-09-01",
  holidays: string[] = [],
): ExtendedAttendanceDashboardData[] {
  const dataMap = new Map(allMonthData.map((md) => [`${md.group}|${md.month}`, md]));

  return stats.map((stat): ExtendedAttendanceDashboardData => {
    const monthData = dataMap.get(`${stat.group}|${stat.month}`);
    const records = monthData?.records ?? [];
    const dayListFull = buildDayList(records);

    // Находим лучших студентов (всех с максимальным процентом)
    let bestStudent = undefined;
    if (stat.students.length > 0) {
      const maxPercent = Math.max(...stat.students.map(s => s.attendancePercent));
      const bestStudents = stat.students.filter(s => s.attendancePercent === maxPercent);
      // Для обратной совместимости оставляем одного, но в name добавляем пометку о других
      bestStudent = {
        fio: bestStudents.length === 1
          ? bestStudents[0].fio
          : `${bestStudents[0].fio} (+${bestStudents.length - 1})`,
        attendancePercent: maxPercent,
      };
    }

    // Находим студентов, требующих внимания (всех с минимальным процентом)
    let riskStudent = undefined;
    if (stat.students.length > 0) {
      const minPercent = Math.min(...stat.students.map(s => s.attendancePercent));
      const riskStudents = stat.students.filter(s => s.attendancePercent === minPercent);
      riskStudent = {
        fio: riskStudents.length === 1
          ? riskStudents[0].fio
          : `${riskStudents[0].fio} (+${riskStudents.length - 1})`,
        attendancePercent: minPercent,
      };
    }

    const studentRows = buildStudentRows(stat.students, records, dayListFull);

    // ----- 2. Календарь месяца и расписание группы -----
    const holidaySet = new Set(holidays);
    console.log('holidaySet:', [...holidaySet]);
    const monthCalendar = getMonthCalendar(stat.month, semesterStart, holidaySet)
      .filter(day => !holidaySet.has(`${stat.month.slice(0, 4)}-${stat.month.slice(4, 6)}-${day.date}`));
    const groupLessons = groupScheduleLessons[stat.group] ?? [];

    // Подсчитываем total пар для каждого предмета за месяц
    const subjectTotalLessons = new Map<string, number>(); // предмет -> всего пар в месяце
    for (const day of monthCalendar) {
      const lessonsOnDay = groupLessons.filter(
        (l) =>
          l.dayIndex === day.dayIndex &&
          (l.week === "both" || l.week === day.weekParity),
      );
      for (const l of lessonsOnDay) {
        subjectTotalLessons.set(
          l.subject,
          (subjectTotalLessons.get(l.subject) ?? 0) + 1,
        );
      }
    }

    // ----- 3. Посещаемость по предметам -----
    // studentSubjectVisited: fio -> subject -> visited count
    const studentSubjectVisited = new Map<string, Map<string, number>>();

    // Группируем записи по студентам и датам
    const studentRecords = new Map<string, Map<string, AttendanceRecord[]>>();
    for (const rec of records) {
      if (!studentRecords.has(rec.fio)) studentRecords.set(rec.fio, new Map());
      const dayMap = studentRecords.get(rec.fio)!;
      const key = normalizeDate(rec.date);
      if (!dayMap.has(key)) dayMap.set(key, []);
      dayMap.get(key)!.push(rec);
    }

    // Для каждого студента и каждого дня определяем посещённые предметы
    for (const [fio, dayMap] of studentRecords.entries()) {
      const subjectVisited = new Map<string, number>();
      studentSubjectVisited.set(fio, subjectVisited);

      for (const [date, dayRecords] of dayMap.entries()) {
        // Находим день в календаре
        const calDay = monthCalendar.find((d) => d.date === date);
        if (!calDay) continue;

        // Пары, которые должны быть в этот день
        const lessonsOnDay = groupLessons.filter(
          (l) =>
            l.dayIndex === calDay.dayIndex &&
            (l.week === "both" || l.week === calDay.weekParity),
        );

        for (const lesson of lessonsOnDay) {
          // Проверяем, был ли студент на этой паре
          const attended = dayRecords.some(
            (rec) =>
              rec.present &&
              overlapsByTime(rec.timeIn, rec.timeOut, lesson.timeIn, lesson.timeOut),
          );
          if (attended) {
            subjectVisited.set(
              lesson.subject,
              (subjectVisited.get(lesson.subject) ?? 0) + 1,
            );
          }
        }
      }
    }

    // ----- 4. Сводка по предметам (subjectSummaries) -----
    const subjectSummaries: SubjectSummary[] = [];
    const allSubjects = Array.from(subjectTotalLessons.keys()).sort();

    for (const subject of allSubjects) {
      const totalLessons = subjectTotalLessons.get(subject) ?? 0;
      if (totalLessons === 0) continue;

      let totalVisitedAllStudents = 0;
      let bestPercent = -1;
      let worstPercent = 101;
      const bestNames: string[] = [];
      const worstNames: string[] = [];

      for (const student of stat.students) {
        const visited = studentSubjectVisited.get(student.fio)?.get(subject) ?? 0;
        totalVisitedAllStudents += visited; // ✅ добавляем накопление

        const studentPercent = totalLessons > 0 ? Math.round((visited / totalLessons) * 100) : 0;

        // Лучшие
        if (studentPercent > bestPercent) {
          bestPercent = studentPercent;
          bestNames.length = 0;
          bestNames.push(student.fio);
        } else if (studentPercent === bestPercent) {
          bestNames.push(student.fio);
        }

        // Худшие
        if (studentPercent < worstPercent) {
          worstPercent = studentPercent;
          worstNames.length = 0;
          worstNames.push(student.fio);
        } else if (studentPercent === worstPercent) {
          worstNames.push(student.fio);
        }
      }

      const bestName = bestNames.length === 1 ? bestNames[0] : `${bestNames[0]} (+${bestNames.length - 1})`;
      const worstName = worstNames.length === 1 ? worstNames[0] : `${worstNames[0]} (+${worstNames.length - 1})`;

      const overallPercent = stat.students.length > 0 && totalLessons > 0
        ? Math.round((totalVisitedAllStudents / (totalLessons * stat.students.length)) * 100)
        : 0;

      subjectSummaries.push({
        subject,
        overallPercent,
        best: { name: bestName, percent: bestPercent === -1 ? 0 : bestPercent },
        worst: { name: worstName, percent: worstPercent === 101 ? 0 : worstPercent },
      });
    }

    // ----- 5. disciplineRows (общая таблица предметов) -----
    const disciplineRows = subjectSummaries.map((s) => {
      const totalLessons = subjectTotalLessons.get(s.subject) ?? 0;
      const totalPossible = totalLessons * stat.students.length;
      const visitedAll = stat.students.reduce((sum, st) => {
        return sum + (studentSubjectVisited.get(st.fio)?.get(s.subject) ?? 0);
      }, 0);
      return {
        discipline: s.subject,
        visited: visitedAll,
        total: totalPossible,
        status: statusByPercent(totalPossible > 0 ? Math.round((visitedAll / totalPossible) * 100) : 0),
      };
    });

    // Если нет расписания – fallback на старую логику
    const effectiveDisciplineRows =
      disciplineRows.length > 0
        ? disciplineRows
        : [
          {
            discipline: "Все занятия",
            visited: stat.students.reduce((sum, s) => sum + s.presentDays, 0),
            total: stat.students.reduce((sum, s) => sum + s.totalDays, 0),
            status: statusByPercent(stat.groupAverage),
          },
        ];

    // ----- 6. subjectStudentRows (студенты в разрезе предметов) -----
    const subjectStudentRows: { subject: string; rows: StudentSubjectRow[] }[] =
      allSubjects.map((subject) => {
        const totalLessons = subjectTotalLessons.get(subject) ?? 0;
        const rows: StudentSubjectRow[] = stat.students.map((student) => {
          const visited = studentSubjectVisited.get(student.fio)?.get(subject) ?? 0;
          const percent = totalLessons > 0 ? Math.round((visited / totalLessons) * 100) : 0;
          return {
            name: student.fio,
            visited,
            total: totalLessons,
            percent,
            status: statusByPercent(percent),
          };
        });
        return { subject, rows };
      });

    // ----- 7. studentSubjectDayMap (детализация по дням) -----
    // fio -> subject -> DaySubjectDetail[]
    const studentSubjectDayMap: Record<string, Record<string, DaySubjectDetail[]>> = {};

    for (const student of stat.students) {
      const fio = student.fio;
      studentSubjectDayMap[fio] = {};

      for (const subject of allSubjects) {
        const details: DaySubjectDetail[] = [];

        for (const day of monthCalendar) {
          // Сколько пар предмета в этот день
          const lessonsOnDay = groupLessons.filter(
            (l) =>
              l.dayIndex === day.dayIndex &&
              (l.week === "both" || l.week === day.weekParity) &&
              l.subject === subject,
          );
          const totalToday = lessonsOnDay.length;
          if (totalToday === 0) continue;

          // Сколько из них посетил студент
          const dayRecords = studentRecords.get(fio)?.get(day.date) ?? [];
          let visitedToday = 0;
          for (const lesson of lessonsOnDay) {
            const attended = dayRecords.some(
              (rec) =>
                rec.present &&
                overlapsByTime(rec.timeIn, rec.timeOut, lesson.timeIn, lesson.timeOut),
            );
            if (attended) visitedToday++;
          }
          details.push({ day: day.date, total: totalToday, visited: visitedToday });
        }

        if (details.length > 0) {
          studentSubjectDayMap[fio][subject] = details;
        }
      }
    }

    const firstStudent = stat.students[0]?.fio;
    const firstSubject = allSubjects[0];
    if (firstStudent && firstSubject) {
      const sample = studentSubjectDayMap[firstStudent]?.[firstSubject];
      console.log(`Дни для ${firstStudent} по ${firstSubject}:`, sample);
    }

    // ----- 8. Собираем итоговый объект -----
    return {
      // Старые поля
      group: stat.group,
      studentsCount: stat.students.length,
      period: stat.month,
      days: dayListFull.map((d) => d.label),
      summary: [
        {
          title: "Средняя посещаемость студентов",
          percent: stat.groupAverage,
          note: stat.month,
          name: "",
        },
        {
          title: "Лучший студент",
          name: bestStudent?.fio ?? "—",
          percent: bestStudent?.attendancePercent ?? 0,
          note: stat.month,
        },
        {
          title: "Обратить внимание",
          name: riskStudent?.fio ?? "—",
          percent: riskStudent?.attendancePercent ?? 0,
          note: stat.month,
        },
      ],
      studentRows,
      studentDetailRows: effectiveDisciplineRows, // совместимость
      disciplineRows: effectiveDisciplineRows,
      disciplineStudentRows: stat.students.map((s) => ({
        name: s.fio,
        visited: s.presentDays,
        total: s.totalDays,
        status: statusByPercent(s.attendancePercent),
      })),
      disciplineStudentDetailRows: studentRows,

      // Новые поля
      subjectSummaries,
      subjectStudentRows,
      studentSubjectDayMap,
      studentAttendanceMap: Object.fromEntries(
        stat.students.map(s => [s.fio, s.attendancePercent])
      ),
      subjectSummaryMap: Object.fromEntries(
        subjectSummaries.map(s => [s.subject, s])
      ),
    };
  });
}
