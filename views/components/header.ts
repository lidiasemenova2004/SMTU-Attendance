import logoUrl from "../../src/assets/logo.svg";

export type HeaderAction = {
  label: string;
  route?: string;
  modal?: string;
  action?: string;
};

const monthFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const weekdayFormatter = new Intl.DateTimeFormat("ru-RU", {
  weekday: "long",
});

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getStudyWeek(date: Date): string {
  const semesterStart = new Date(date.getFullYear(), date.getMonth() < 8 ? 1 : 8, 1);
  const daysPassed = Math.floor((date.getTime() - semesterStart.getTime()) / 86_400_000);
  const weekNumber = Math.floor(Math.max(daysPassed, 0) / 7) + 1;

  return weekNumber % 2 === 0 ? "верхняя неделя" : "нижняя неделя";
}

export function formatToday(date = new Date()): string {
  const formattedDate = monthFormatter.format(date);
  const weekday = capitalize(weekdayFormatter.format(date));

  return `Сегодня: ${formattedDate}, ${weekday}, ${getStudyWeek(date)}`;
}

export function renderLogo(): string {
  return `
    <button class="logo logo-button" data-route="home" aria-label="На главную">
      <img src="${logoUrl}" alt="" width="82" height="82" />
    </button>
  `;
}

export function renderAppHeader(options: {
  title?: string;
  subtitle?: string;
  actions?: HeaderAction[];
  compact?: boolean;
} = {}): string {
  const actions = options.actions
    ?.map(
      (action) => `
        <button class="btn-head" ${action.action ? `data-action="${action.action}"` : action.modal ? `data-modal="${action.modal}"` : `data-route="${action.route ?? "home"}"`}>
          <span>${action.label}</span>
        </button>
      `,
    )
    .join("");

  return `
    <header class="header-app ${options.compact ? "app-header compact" : "app-header"}">
      ${renderLogo()}
      <div class="out-logo">
        <div class="date-week-today">
          <p>${formatToday()}</p>
        </div>
        ${
          options.title
            ? `
              <div class="info">
                <div>
                  <h1>${options.title}</h1>
                  ${options.subtitle ? `<p class="groupinfo">${options.subtitle}</p>` : ""}
                </div>
                ${actions ? `<div class="rowhead">${actions}</div>` : ""}
              </div>
            `
            : ""
        }
      </div>
    </header>
  `;
}
