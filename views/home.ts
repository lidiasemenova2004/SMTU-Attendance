import { renderAppHeader } from "./components/header";

export type MainAction = {
  modal: string;
  title: string;
  hint: string;
};

const defaultActions: MainAction[] = [
  {
    modal: "upload-statistic",
    title: "Просмотр статистики",
    hint: "Загрузите готовый JSON-файл с рассчитанной статистикой посещаемости.",
  },
  {
    modal: "isu-login",
    title: "С интернетом",
    hint: "Авторизуйтесь в ИСУ, чтобы получить данные автоматически.",
  },
];

export function renderMainPage(actions = defaultActions): string {
  return `
    ${renderAppHeader()}
    <main>
      <h1>Выберите режим работы приложения</h1>
      <div class="wrapper main-actions">
        ${actions
          .map(
            (action) => `
              <button class="btn" data-modal="${action.modal}">
                <span class="btn-title">${action.title}</span>
                <span class="btn-hits">${action.hint}</span>
              </button>
            `,
          )
          .join("")}
      </div>
    </main>
  `;
}
