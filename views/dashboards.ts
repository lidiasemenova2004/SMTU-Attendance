import { renderAppHeader } from "./components/header.ts";
import "../src/assets/CSS/StatisticStyles.css";

export type DashboardRoute =
  | "students"
  | "student-detail"
  | "disciplines"
  | "discipline-students"
  | "discipline-student-detail";

type SummaryCard = {
  title: string;
  name?: string;
  percent: number;
  note: string;
};

type StudentAttendanceRow = {
  name: string;
  days: string[];
};

type DisciplineRow = {
  discipline: string;
  visited: number;
  total: number;
  status: string;
};

type DisciplineStudentRow = {
  name: string;
  visited: number;
  total: number;
  status: string;
};

export type AttendanceDashboardData = {
  group: string;
  studentsCount: number;
  period: string;
  days: string[];
  summary: SummaryCard[];
  studentRows: StudentAttendanceRow[];
  studentDetailRows: DisciplineRow[];
  disciplineRows: DisciplineRow[];
  disciplineStudentRows: DisciplineStudentRow[];
  disciplineStudentDetailRows: StudentAttendanceRow[];

  subjectSummaries?: {
    subject: string;
    overallPercent: number;
    best: { name: string; percent: number };
    worst: { name: string; percent: number };
  }[];
  subjectStudentRows?: {
    subject: string;
    rows: { name: string; visited: number; total: number; percent: number; status: string }[];
  }[];
  studentSubjectDayMap?: Record<string, Record<string, { day: string; total: number; visited: number }[]>>;
  studentAttendanceMap?: Record<string, number>;
  subjectSummaryMap?: Record<string, {
    subject: string;
    overallPercent: number;
    best: { name: string; percent: number };
    worst: { name: string; percent: number };
  }>
};

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

function formatMonth(period: string): string {
  if (!/^\d{6}$/.test(period)) return period; 
  const year = period.slice(0, 4);
  const monthIndex = parseInt(period.slice(4, 6)) - 1;
  const monthName = MONTH_NAMES[monthIndex] ?? "?";
  return `${monthName} ${year}`;
}

function percent(visited: number, total: number): string {
  return `${Math.round((visited / total) * 100)}%`;
}

function renderSummaryCards(cards: SummaryCard[]): string {
  return `
    <div class="top-row summary-row">
      ${cards.map((card, index) => {
    let title = card.title;
    let tooltipAttr = "";
    if (index === 0 && card.title === "Общая посещаемость") {
      title = "Средняя посещаемость студентов";
      tooltipAttr = 'title="Средний процент присутствия студентов на занятиях за месяц"';
    }
    let note = card.note;
    if (/^\d{6}$/.test(note)) {
      note = formatMonth(note);
    }
    return `
            <div class="wrapper" ${tooltipAttr}>
              <h2>${title}</h2>
              <p class="name">${card.name ?? ""}</p>
              <p class="procent">${card.percent}%</p>
              <p class="notes">${note}</p>
            </div>
          `;
  }).join("")}
    </div>
  `;
}

function renderDashboardHeader(data: AttendanceDashboardData, titleSuffix: string): string {
  return renderAppHeader({
    title: `Статистика группы ${data.group}${titleSuffix}`,
    subtitle: ` ${data.studentsCount} студентов`,
    actions: [
      { label: "Выбрать месяц", modal: "month-picker" },
      { label: "Назад", action: "go-back" },
      { label: "Сохранить", action: "save-report" },
    ],
  });
}

function renderStudentAttendanceTable(data: AttendanceDashboardData, withDetails: boolean): string {
  return `
  <div class="table-scroll">
    <table class="timeinout table-fixed-cols">
      <thead>
        <tr>
          <th>№</th>
          <th>ФИО</th>
          ${data.days.map((day) => `<th>${day}</th>`).join("")}
          ${withDetails ? "<th>Подробнее</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${data.studentRows
      .map(
        (row, index) => `
              <tr>
                <td class="sticky">${index + 1}</td>
                <td class="sticky">${row.name}</td>
                ${row.days.map((day) => `<td>${day}</td>`).join("")}
                ${withDetails
            ? `<td><a href="#student-detail" data-student-name="${encodeURIComponent(row.name)}">Подробнее</a></td>`
            : ""}
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
    </div>
  `;
}

function renderDisciplineTable(rows: DisciplineRow[], withDetails: boolean): string {
  return `
    <table class="disp">
      <thead>
        <tr>
          <th>Дисциплина</th>
          <th>Посещено</th>
          <th>Всего занятий</th>
          <th>Процент</th>
          <th>Статус</th>
          ${withDetails ? "<th>Подробнее</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${rows
      .map(
        (row) => `
              <tr>
                <td>${row.discipline}</td>
                <td>${row.visited}</td>
                <td>${row.total}</td>
                <td>${percent(row.visited, row.total)}</td>
                <td>${row.status}</td>
                ${withDetails
            ? `<td><a href="#discipline-students" data-discipline-name="${encodeURIComponent(row.discipline)}">Подробнее</a></td>`
            : ""}
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
  `;
}

function renderDisciplineStudentsTable(rows: DisciplineStudentRow[]): string {
  return `
    <table class="studdisp">
      <thead>
        <tr>
          <th>№</th>
          <th>ФИО</th>
          <th>Посещено</th>
          <th>Всего занятий</th>
          <th>Процент</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        ${rows
      .map(
        (row, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${row.name}</td>
                <td>${row.visited}</td>
                <td>${row.total}</td>
                <td>${percent(row.visited, row.total)}</td>
                <td>${row.status}</td>
              </tr>
            `,
      )
      .join("")}
      </tbody>
    </table>
  `;
}

function renderDisciplineGroupDayTable(
  data: AttendanceDashboardData,
  disciplineName: string,
): string {
  const allDaysSet = new Set<string>();
  const subjectDayMap = data.studentSubjectDayMap;
  if (subjectDayMap) {
    for (const fio of Object.keys(subjectDayMap)) {
      const discData = subjectDayMap[fio]?.[disciplineName];
      if (discData) {
        for (const d of discData) {
          allDaysSet.add(d.day);
        }
      }
    }
  }

  const displayDays = Array.from(allDaysSet).sort(
    (a, b) => parseInt(a) - parseInt(b),
  );

  if (displayDays.length === 0) {
    return `<p>Нет данных по дням для дисциплины «${disciplineName}»</p>`;
  }

  return `
    <table class="timeinout">
      <thead>
        <tr>
          <th>№</th>
          <th>ФИО</th>
          ${displayDays.map((day) => `<th>${day}</th>`).join("")}
        </tr>
      </thead>
      <tbody>
        ${data.studentRows
      .map((row, index) => {
        const studentDaysData =
          data.studentSubjectDayMap?.[row.name]?.[disciplineName];

        const dayCells = displayDays
          .map((day) => {
            if (!studentDaysData) return "<td>—</td>";
            const dayInfo = studentDaysData.find((d) => d.day === day);
            if (!dayInfo) return "<td>—</td>";
            return `<td>${dayInfo.visited}/${dayInfo.total}</td>`;
          })
          .join("");

        return `
              <tr>
                <td>${index + 1}</td>
                <td>${row.name}</td>
                ${dayCells}
              </tr>`;
      })
      .join("")}
      </tbody>
    </table>
  `;
}

export function renderDashboardView(
  route: DashboardRoute,
  data: AttendanceDashboardData,
  selectedStudent?: string,
  selectedDiscipline?: string,
): string {
  const currentDiscipline = selectedDiscipline ?? data.disciplineRows[0]?.discipline ?? "";

  if (route === "student-detail") {
    const studentName = selectedStudent ?? data.studentRows[0]?.name ?? "";
    const studentPercent = data.studentAttendanceMap?.[studentName] ?? 0;

    let bestSubject = { name: "—", percent: 0 };
    let worstSubject = { name: "—", percent: 100 };
    const studentSubjRows = (data.subjectStudentRows ?? [])
      .map(s => ({
        subject: s.subject,
        row: s.rows.find(r => r.name === studentName),
      }))
      .filter(item => item.row != null);
    if (studentSubjRows.length > 0) {
      const valid = studentSubjRows.map(s => ({ name: s.subject, percent: s.row!.percent }));
      bestSubject = valid.reduce((max, cur) => cur.percent > max.percent ? cur : max, valid[0]);
      worstSubject = valid.reduce((min, cur) => cur.percent < min.percent ? cur : min, valid[0]);
    }

    const studentDetailSummary: SummaryCard[] = [
      {
        title: "Посещаемость студента",
        percent: studentPercent,
        note: data.period,
        name: "",
      },
      {
        title: "Лучший предмет",
        name: bestSubject.name,
        percent: bestSubject.percent,
        note: data.period,
      },
      {
        title: "Требует внимания",
        name: worstSubject.name,
        percent: worstSubject.percent,
        note: data.period,
      },
    ];

    const studentDisciplineRows: DisciplineRow[] = studentSubjRows.map(s => ({
      discipline: s.subject,
      visited: s.row!.visited,
      total: s.row!.total,
      status: s.row!.status,
    }));

    return `
    ${renderDashboardHeader(data, `. ${studentName}`)}
    <main>
      ${renderSummaryCards(studentDetailSummary)}
      <div class="wrapper">
        <div class="wrapper-title">Посещаемость студента за ${formatMonth(data.period)}</div>
        ${renderDisciplineTable(studentDisciplineRows, false)}
      </div>
    </main>
  `;
  }

  if (route === "disciplines") {
    let bestDisc = { name: "—", percent: 0 };
    let worstDisc = { name: "—", percent: 100 };
    if (data.subjectSummaries && data.subjectSummaries.length > 0) {
      bestDisc = data.subjectSummaries.reduce(
        (max, s) => s.overallPercent > max.percent ? { name: s.subject, percent: s.overallPercent } : max,
        { name: data.subjectSummaries[0].subject, percent: data.subjectSummaries[0].overallPercent }
      );
      worstDisc = data.subjectSummaries.reduce(
        (min, s) => s.overallPercent < min.percent ? { name: s.subject, percent: s.overallPercent } : min,
        { name: data.subjectSummaries[0].subject, percent: data.subjectSummaries[0].overallPercent }
      );
    }

    const discSummaryCards: SummaryCard[] = [
      data.summary[0],
      {
        title: "Лучшая дисциплина",
        name: bestDisc.name,
        percent: bestDisc.percent,
        note: data.period,
      },
      {
        title: "Обратить внимание",
        name: worstDisc.name,
        percent: worstDisc.percent,
        note: data.period,
      },
    ];

    return `
    ${renderDashboardHeader(data, "")}
    <main>
      ${renderSummaryCards(discSummaryCards)}
      <div class="wrapper">
        <div class="wrapper-title">Посещаемость дисциплин за ${formatMonth(data.period)}</div>
        ${renderDisciplineTable(data.disciplineRows, true)}
      </div>
    </main>
  `;
  }

  if (route === "discipline-students") {
    const disciplineName = selectedDiscipline ?? data.disciplineRows[0]?.discipline ?? "";
    const subjSummary = data.subjectSummaryMap?.[disciplineName];

    const discStudSummaryCards: SummaryCard[] = subjSummary
      ? [
        {
          title: "Посещаемость дисциплины",
          percent: subjSummary.overallPercent,
          note: data.period,
          name: "",
        },
        {
          title: "Лучший студент",
          name: subjSummary.best.name,
          percent: subjSummary.best.percent,
          note: data.period,
        },
        {
          title: "Обратить внимание",
          name: subjSummary.worst.name,
          percent: subjSummary.worst.percent,
          note: data.period,
        },
      ]
      : data.summary;

    const subjectData = data.subjectStudentRows?.find(s => s.subject === disciplineName);
    const studentRows: DisciplineStudentRow[] = subjectData
      ? subjectData.rows.map(r => ({
        name: r.name,
        visited: r.visited,
        total: r.total,
        status: r.status,
      }))
      : data.disciplineStudentRows;

    return `
    ${renderDashboardHeader(data, `. ${disciplineName}`)}
    <main>
      ${renderSummaryCards(discStudSummaryCards)}
      <div class="wrapper">
        <div class="top-row table-head-row">
          <div class="wrapper-title">Посещаемость дисциплины</div>
          <a href="#discipline-student-detail"
             class="wrapper-title"
             data-discipline-detail-link
             data-discipline-name="${encodeURIComponent(disciplineName)}">Подробнее</a>
        </div>
        ${renderDisciplineStudentsTable(studentRows)}
      </div>
    </main>
  `;
  }

  if (route === "discipline-student-detail") {
    const discipline = selectedDiscipline ?? currentDiscipline;
    const subjSummary = data.subjectSummaryMap?.[discipline];
    const discStudSummaryCards: SummaryCard[] = subjSummary
      ? [
        {
          title: "Посещаемость дисциплины",
          percent: subjSummary.overallPercent,
          note: data.period,
          name: "",
        },
        {
          title: "Лучший студент",
          name: subjSummary.best.name,
          percent: subjSummary.best.percent,
          note: data.period,
        },
        {
          title: "Обратить внимание",
          name: subjSummary.worst.name,
          percent: subjSummary.worst.percent,
          note: data.period,
        },
      ]
      : data.summary;

    return `
    ${renderDashboardHeader(data, `. ${discipline}`)}
    <main>
      ${renderSummaryCards(discStudSummaryCards)}
      <div class="wrapper">
        <div class="wrapper-title">Посещаемость по дням — ${discipline}</div>
        ${renderDisciplineGroupDayTable(data, discipline)}
      </div>
    </main>
  `;
  }

  return `
    ${renderDashboardHeader(data, "")}
    <main>
      ${renderSummaryCards(data.summary)}
      <div class="wrapper">
        <div class="wrapper-title">Посещаемость студентов за ${formatMonth(data.period)}</div>
        ${renderStudentAttendanceTable(data, true)}
      </div>
    </main>
  `;
}