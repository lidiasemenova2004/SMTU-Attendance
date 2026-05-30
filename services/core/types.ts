import type { AttendanceDashboardData } from "../../views/dashboards.ts";

export interface AttendanceRecord {
  studentNumber: number;
  fio: string;
  date: string;
  dayOfWeek: string;
  timeIn?: string;
  timeOut?: string;
  present: boolean;
}

export interface MonthData {
  group: string;
  month: string;
  records: AttendanceRecord[];
}

export interface StudentStat {
  fio: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendancePercent: number;
}

export interface GroupStats {
  group: string;
  month: string;
  students: StudentStat[];
  groupAverage: number;
}

export interface PipelineResult {
  groups: string[];
  dashboardDatas: ExtendedAttendanceDashboardData[];
}
// types.ts (или прямо в модуле)
export interface SubjectSummary {
  subject: string;
  overallPercent: number;
  best: { name: string; percent: number };
  worst: { name: string; percent: number };
}

export interface StudentSubjectRow {
  name: string;
  visited: number;
  total: number;
  percent: number;
  status: string;
}

export interface DaySubjectDetail {
  day: string;          // "01", "02", ...
  total: number;        // сколько пар этого предмета было в этот день
  visited: number;      // сколько из них посетил студент
}

export interface ExtendedAttendanceDashboardData extends AttendanceDashboardData {
  subjectSummaries: SubjectSummary[];                     // сводка по каждому предмету
  subjectStudentRows: { subject: string; rows: StudentSubjectRow[] }[]; // студенты в разрезе предметов
  studentSubjectDayMap: Record<string, Record<string, DaySubjectDetail[]>>; // fio -> subject -> детали по дням
  studentAttendanceMap: Record<string, number>;        // <-- вот это
  subjectSummaryMap: Record<string, SubjectSummary>;
}