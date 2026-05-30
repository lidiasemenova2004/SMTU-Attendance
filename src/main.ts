import "./assets/CSS/RootStyles.css";
import "./assets/CSS/ButtonStyles.css";
import "./assets/CSS/ListStyles.css";
import "./assets/CSS/StatisticStyles.css";
import "./assets/CSS/DialogStyles.css";
import "./assets/CSS/WaitStyles.css";
import "./styles.css";

import {
  loadAttendanceReport,
  readAttendanceReportFile,
  type AttendanceReport,
} from "./backend.ts";
import { renderModal, type ModalKind } from "../views/components/modals.ts";
import { AttendanceDashboardData, renderDashboardView, type DashboardRoute } from "../views/dashboards.ts";
import { renderMainPage } from "../views/home.ts";
import { renderGroupsPage, type GroupItem } from "../views/list-group.ts";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { runFullPipeline } from "../services/core/pipeline.ts";
import { requestSave } from "../services/core/utils/saver.ts";

type AppRoute = "home" | "groups" | DashboardRoute;

const app = document.querySelector<HTMLDivElement>("#app");
let currentModal: ModalKind | null = null;
let attendanceReport: AttendanceReport | null = null;
let selectedGroup: string | null = null;
let selectedMonth: string | null = null;
let appMessage: string | null = null;
let isClosing = false;
export let selectedStudent: string | null = null;
export let selectedDiscipline: string | null = null;

const routeTitles: Record<AppRoute, string> = {
  home: "SMTU Attendance",
  groups: "Groups",
  students: "Students stats",
  "student-detail": "Student stats",
  disciplines: "Disciplines stats",
  "discipline-students": "Discipline students",
  "discipline-student-detail": "Discipline details",
};

const modalTitles: Record<ModalKind, string> = {
  "isu-login": "ISU auth",
  "upload-files": "Upload files",
  "upload-statistic": "Upload stats",
  wait: "Please wait",
  saving: "Save data",
  "view-mode": "View mode",
  "month-picker": "Select month",
};

function isRoute(route: string): route is AppRoute {
  return route in routeTitles;
}

function isModal(modal: string): modal is ModalKind {
  return modal in modalTitles;
}

function getRoute(): AppRoute {
  const route = window.location.hash.replace("#", "");
  return isRoute(route) ? route : "home";
}

function getSelectedDashboardData(): AttendanceDashboardData | undefined {
  const all = attendanceReport?.dashboardDatas ?? [];
  const byGroup = all.filter((d) => d.group === selectedGroup);
  const source = byGroup.length > 0 ? byGroup : all;
  if (source.length === 0) return undefined;
  if (!selectedMonth) return source[0];
  return source.find((d) => d.period === selectedMonth) ?? source[0];
}

function getAvailableMonthsForSelectedGroup(): string[] {
  if (!attendanceReport || !selectedGroup) return [];
  const periods = attendanceReport.dashboardDatas
    .filter((d) => d.group === selectedGroup)
    .map((d) => d.period);
  return Array.from(new Set(periods)).sort();
}

function syncSelectedMonthForGroup(): void {
  const months = getAvailableMonthsForSelectedGroup();
  if (months.length === 0) {
    selectedMonth = null;
    return;
  }
  if (!selectedMonth || !months.includes(selectedMonth)) {
    selectedMonth = months[0];
  }
}

function renderRoute(route: AppRoute): string {
  switch (route) {
    case "home":
      return renderMainPage();
    case "groups": {
      const uniqueGroups = Array.from(new Set((attendanceReport?.dashboardDatas ?? []).map((stats) => stats.group)));
      const groups: GroupItem[] = uniqueGroups.map((group) => ({ id: group, modal: "view-mode" }));
      return renderGroupsPage(groups);
    }
    default: {
      const data = getSelectedDashboardData();
      if (!data) {
        return `<div class="wrapper"><p class="error-message">No data to display. Load report first.</p></div>`;
      }
      // Передаём глобальные выбранные значения
      return renderDashboardView(route, data, selectedStudent ?? undefined, selectedDiscipline ?? undefined);
    }
  }
}

function navigate(route: AppRoute): void {
  currentModal = null;
  window.location.hash = route === "home" ? "" : route;
}

function openModal(modal: ModalKind): void {
  currentModal = modal;
  appMessage = null;
  render();
}

function closeModal(): void {
  currentModal = null;
  render();
}

function render(): void {
  if (!app) return;

  const route = getRoute();
  document.title = currentModal ? `${modalTitles[currentModal]} - ${routeTitles[route]}` : routeTitles[route];
  document.body.classList.toggle("modal-open", currentModal !== null);
  app.innerHTML = `
  ${appMessage ? `<div class="app-message">${appMessage}</div>` : ""}
  ${renderRoute(route)}
  ${currentModal ? renderModal(currentModal, { months: getAvailableMonthsForSelectedGroup(), selectedMonth }) : ""}`;
}

document.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  // Обработчик перехода в детализацию дисциплины по дням (групповая таблица)
  const disciplineDetailLink = target.closest<HTMLElement>("[data-discipline-detail-link]");
  if (disciplineDetailLink) {
    event.preventDefault();
    selectedDiscipline = decodeURIComponent(disciplineDetailLink.dataset.disciplineName ?? "");
    navigate("discipline-student-detail");
    return;
  }
  // Обработка "Подробнее" для студента
  const studentLink = target.closest<HTMLElement>("[data-student-name]");
  if (studentLink) {
    event.preventDefault();
    selectedStudent = decodeURIComponent(studentLink.dataset.studentName ?? "");
    navigate("student-detail");
    return;
  }

  // Обработка "Подробнее" для дисциплины
  const disciplineLink = target.closest<HTMLElement>("[data-discipline-name]");
  if (disciplineLink) {
    event.preventDefault();
    selectedDiscipline = decodeURIComponent(disciplineLink.dataset.disciplineName ?? "");
    navigate("discipline-students");
    return;
  }
  const goBackButton = target.closest("[data-action='go-back']");
  if (goBackButton) {
    event.preventDefault();
    window.history.back();
    return;
  }
  if (target.closest("[data-action='save-report']")) {
    event.preventDefault();
    console.log("here");
    if (attendanceReport) {
      void requestSave().then((saved) => {
        console.log("second");
        if (saved && isClosing) closeModal();
      });
    } else {
      closeModal();
    }
    return;
  }

  if (target.closest("[data-action='discard-close']")) {
    event.preventDefault();
    closeModal();
    if (isClosing) getCurrentWindow().close();
    return;
  }

  const modalElement = target.closest<HTMLElement>("[data-modal]");
  const modal = modalElement?.dataset.modal;
  if (modal && isModal(modal)) {
    const groupButton = modalElement.closest<HTMLElement>("[data-group]");
    selectedGroup = groupButton?.dataset.group ?? selectedGroup;
    syncSelectedMonthForGroup();
    event.preventDefault();
    openModal(modal);
    return;
  }

  if (target.closest("[data-close-modal]")) {
    event.preventDefault();
    closeModal();
    return;
  }

  const routeElement = target.closest<HTMLElement>("[data-route]");
  const route = routeElement?.dataset.route;
  if (route && isRoute(route)) {
    event.preventDefault();
    navigate(route);
  }

});

document.addEventListener("submit", (event) => {
  const form = event.target as HTMLFormElement;

  if (form.matches("[data-report-upload]")) {
    event.preventDefault();
    void importReportFromForm(form);
    return;
  }

  if (form.matches("[data-month-select]")) {
    event.preventDefault();
    const formData = new FormData(form);
    selectedMonth = (formData.get("month") as string) || null;
    closeModal();
    render();
    return;
  }

  const nextModal = form.dataset.nextModal;

  if (!nextModal || !isModal(nextModal)) {
    return;
  }

  event.preventDefault();

  if (currentModal === "isu-login" && nextModal === "wait") {
    const formData = new FormData(form);
    const email = ((formData.get("login") as string) ?? "").trim();
    const password = (formData.get("password") as string) ?? "";

    openModal("wait");

    const updateWaitStatus = (status: string) => {
      const statusEl = document.querySelector("#wait-status");
      if (statusEl) statusEl.textContent = status;
    };

    const stubOnly = !email || !password;

    runFullPipeline(email, password, updateWaitStatus, { stubOnly })
      .then((result) => {
        attendanceReport = {
          groups: result.groups,
          dashboardDatas: result.dashboardDatas,
        };
        selectedGroup = result.dashboardDatas[0]?.group ?? null;
        selectedMonth = result.dashboardDatas[0]?.period ?? null;
        syncSelectedMonthForGroup();
        closeModal();
        navigate("groups");
      })
      .catch((error: unknown) => {
        console.error("Pipeline error:", error);
        const message = error instanceof Error ? error.message : String(error);
        appMessage = `Data load error: ${message}`;
        closeModal();
        navigate("home");
      });
    return;
  }

  openModal(nextModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && currentModal) {
    closeModal();
  }
});

listen("tauri://close-requested", async () => {
  isClosing = true;
  if (!attendanceReport) {
    getCurrentWindow().close();
    return;
  }
  openModal("saving");
});

window.addEventListener("hashchange", render);
window.addEventListener("DOMContentLoaded", () => {
  render();
  void loadInitialReport();
});

async function loadInitialReport(): Promise<void> {
  try {
    attendanceReport = await loadAttendanceReport();
    selectedGroup = attendanceReport.dashboardDatas[0]?.group ?? null;
    selectedMonth = attendanceReport.dashboardDatas[0]?.period ?? null;
    syncSelectedMonthForGroup();
    render();
  } catch (error) {
    console.info("Attendance report is not loaded yet:", error);
  }
}

async function importReportFromForm(form: HTMLFormElement): Promise<void> {
  const input = form.querySelector<HTMLInputElement>('input[type="file"]');
  const file = input?.files?.[0];

  if (!file) {
    appMessage = "Choose JSON report file.";
    render();
    return;
  }

  try {
    attendanceReport = await readAttendanceReportFile(file);
    selectedGroup = attendanceReport.dashboardDatas[0]?.group ?? null;
    selectedMonth = attendanceReport.dashboardDatas[0]?.period ?? null;
    syncSelectedMonthForGroup();
    currentModal = null;
    navigate("groups");
  } catch (error) {
    appMessage = error instanceof Error ? error.message : "Failed to load file.";
    render();
  }
}
