export type ModalKind =
  | "isu-login"
  | "upload-files"
  | "upload-statistic"
  | "wait"
  | "saving"
  | "view-mode"
  | "month-picker";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
] as const;

function formatMonth(period: string): string {
  if (!/^\d{6}$/.test(period)) return period;
  const year = period.slice(0, 4);
  const monthIndex = parseInt(period.slice(4, 6)) - 1;
  const monthName = MONTHS[monthIndex] ?? "?";
  return `${monthName} ${year}`;
}

function renderDialogShell(content: string, cardClassName = ""): string {
  return `
    <div class="modal-overlay" role="presentation">
      <section class="dialog-card ${cardClassName}" role="dialog" aria-modal="true">
        <header class="header-modal">
          <button class="close-button" data-close-modal aria-label="Закрыть">&times;</button>
        </header>
        ${content}
      </section>
    </div>
  `;
}

export function renderIsuLoginModal(): string {
  return renderDialogShell(`
    <form data-next-modal="wait">
      <h1>Авторизация в ИСУ</h1>
      <input class="textbox" type="text" name="login" placeholder="Логин" autocomplete="username" />
      <input class="textbox" type="password" name="password" placeholder="Пароль" autocomplete="current-password" />
      <button class="btnbox" type="submit">Войти</button>
    </form>
  `);
}

export function renderUploadFilesModal(): string {
  return renderDialogShell(`
    <form data-report-upload>
      <h1>Загрузка файлов</h1>
      <label for="schedule" class="labelbox">
        <span class="text">Расписание</span>
        <span class="btn-file">Выберите файл</span>
      </label>
      <input id="schedule" class="filebox" type="file" accept=".json,application/json" />
      <label for="attendance" class="labelbox">
        <span class="text">Статистика</span>
        <span class="btn-file">Выберите файл</span>
      </label>
      <input id="attendance" class="filebox" type="file" accept=".json,application/json" />
      <button id="upload" class="btnbox" type="submit">Загрузить</button>
    </form>
  `);
}

export function renderUploadStatisticModal(): string {
  return renderDialogShell(`
    <form data-report-upload>
      <h1>Загрузка файла</h1>
      <label for="statistic" class="labelbox">
        <span class="text">Статистика</span>
        <span class="btn-file">Выберите файл</span>
      </label>
      <input id="statistic" class="filebox" type="file" accept=".json,application/json" />
      <button class="btnbox" type="submit">Загрузить</button>
    </form>
  `);
}

export function renderWaitModal(status = "Пожалуйста, подождите"): string {
  return renderDialogShell(`
    <div class="dialog-content">
      <h1>Пожалуйста, подождите</h1>
      <div class="wait-state loading-container">
        <div class="loading-bar-wrapper">
                <div class="loading-bar-fill"></div>
            </div>
        <p id="wait-status" class="dots">${status}</p>
      </div>
      <!--<button class="btnbox" data-route="groups">К списку групп</button>-->
    </div>
  `);
}

export function renderSavingModal(): string {
  return renderDialogShell(`
    <div class="dialog-content">
      <h1>Хотите сохранить данные?</h1>
      <div class="top-row">
        <button class="btn" data-action="discard-close">
          <span class="open-text">Не сохранять</span>
        </button>
        <button class="btn" data-action="save-report">
          <span class="open-text">Сохранить</span>
        </button>
      </div>
    </div>
  `);
}

export function renderViewModeModal(): string {
  return renderDialogShell(`
    <div class="wrapper-modal">
      <button class="btn" data-route="students">
        <span class="open-text">Открыть посещаемость группы по студентам</span>
      </button>
      <button class="btn" data-route="disciplines">
        <span class="open-text">Открыть посещаемость группы по дисциплинам</span>
      </button>
    </div>
  `, "infoWind");
}

export function renderMonthPickerModal(
  months: string[] = [],
  selectedMonth: string | null = null,
): string {
  const options = months
    .map(
      (month) =>
        `<option value="${month}" ${month === selectedMonth ? "selected" : ""}>${formatMonth(month)}</option>`
    )
    .join("");

  return renderDialogShell(`
    <form data-month-select>
      <h1>Выбор месяца</h1>
      <select class="textbox" name="month" ${months.length === 0 ? "disabled" : ""}>
        ${options || '<option value="">Нет доступных месяцев</option>'}
      </select>
      <button class="btnbox" type="submit" ${months.length === 0 ? "disabled" : ""}>Показать</button>
    </form>
  `);
}

export function renderModal(
  kind: ModalKind,
  options?: { months?: string[]; selectedMonth?: string | null },
): string {
  switch (kind) {
    case "isu-login":
      return renderIsuLoginModal();
    case "upload-files":
      return renderUploadFilesModal();
    case "upload-statistic":
      return renderUploadStatisticModal();
    case "wait":
      return renderWaitModal();
    case "saving":
      return renderSavingModal();
    case "view-mode":
      return renderViewModeModal();
    case "month-picker":
      return renderMonthPickerModal(options?.months, options?.selectedMonth ?? null);
  }
}
