import { invoke } from "@tauri-apps/api/core";
import { ExtendedAttendanceDashboardData, PipelineResult } from "../services/core/types.ts";

export type StudentStat = {
  fio: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercent: number;
};

export type GroupStats = {
  group: string;
  month: string;
  students: StudentStat[];
  groupAverage: number;
};

export type AttendanceReport = {
  groups: string[];
  dashboardDatas: ExtendedAttendanceDashboardData[];
};
/* 
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
} */

/* function normalizeReport(value: unknown): AttendanceReport {
  if (Array.isArray(value)) {
    const stats = value.filter(isGroupStats);
    return {
      groups: stats.map((item) => item.group),
      stats,
    };
  }

  if (isRecord(value) && Array.isArray(value.stats)) {
    const stats = value.stats.filter(isGroupStats);
    const groups = Array.isArray(value.groups)
      ? value.groups.filter((group): group is string => typeof group === "string")
      : stats.map((item) => item.group);

    return { groups, stats };
  }

  throw new Error("JSON does not contain attendance stats");
}

function isGroupStats(value: unknown): value is GroupStats {
  return (
    isRecord(value) &&
    typeof value.group === "string" &&
    typeof value.month === "string" &&
    typeof value.groupAverage === "number" &&
    Array.isArray(value.students)
  );
}

function statusByPercent(value: number): string {
  if (value >= 85) return "Отлично";
  if (value >= 70) return "Хорошо";
  if (value >= 50) return "Удовлетворительно";
  return "Требует внимания";
}

function getBestStudent(students: StudentStat[]): StudentStat | undefined {
  return [...students].sort((a, b) => b.attendancePercent - a.attendancePercent)[0];
}

function getRiskStudent(students: StudentStat[]): StudentStat | undefined {
  return [...students].sort((a, b) => a.attendancePercent - b.attendancePercent)[0];
} */
/*
export function groupStatsToDashboardData(stats: GroupStats): AttendanceDashboardData {
  const bestStudent = getBestStudent(stats.students);
  const riskStudent = getRiskStudent(stats.students);

  return {
    group: stats.group,
    studentsCount: stats.students.length,
    period: stats.month.includes("-") ? stats.month : `${stats.month} (текущий семестр)`,
    days: ["Посещено", "Пропущено", "Всего"],
    summary: [
      {
        title: "Общая посещаемость",
        percent: stats.groupAverage,
        note: stats.month,
      },
      {
        title: "Лучший студент",
        name: bestStudent?.fio,
        percent: bestStudent?.attendancePercent ?? 0,
        note: stats.month,
      },
      {
        title: "Обратить внимание",
        name: riskStudent?.fio,
        percent: riskStudent?.attendancePercent ?? 0,
        note: stats.month,
      },
    ],
    studentRows: stats.students.map((student) => ({
      name: student.fio,
      days: [String(student.presentDays), String(student.absentDays), String(student.totalDays)],
    })),
    studentDetailRows: [
      {
        discipline: "Все занятия",
        visited: bestStudent?.presentDays ?? 0,
        total: bestStudent?.totalDays ?? 0,
        status: statusByPercent(bestStudent?.attendancePercent ?? 0),
      },
    ],
    disciplineRows: [
      {
        discipline: "Все дисциплины",
        visited: stats.students.reduce((sum, student) => sum + student.presentDays, 0),
        total: stats.students.reduce((sum, student) => sum + student.totalDays, 0),
        status: statusByPercent(stats.groupAverage),
      },
    ],
    disciplineStudentRows: stats.students.map((student) => ({
      name: student.fio,
      visited: student.presentDays,
      total: student.totalDays,
      status: statusByPercent(student.attendancePercent),
    })),
    disciplineStudentDetailRows: stats.students.map((student) => ({
      name: student.fio,
      days: [String(student.presentDays), String(student.absentDays), String(student.totalDays)],
    })),
  };
}*/

export async function loadAttendanceReport(): Promise<AttendanceReport> {
  const result: PipelineResult = await invoke('load_attendance_report');
  return {
    groups: result.groups,
    dashboardDatas: result.dashboardDatas, // уже готовые
  };
}

export async function readAttendanceReportFile(file: File): Promise<AttendanceReport> {
  const result: PipelineResult = JSON.parse(await file.text());
  // ожидаем, что файл содержит полный PipelineResult
  return {
    groups: result.groups,
    dashboardDatas: result.dashboardDatas,
  };
}
