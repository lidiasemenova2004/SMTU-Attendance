import { renderAppHeader } from "./components/header";

export type GroupItem = {
  id: string;
  modal: string;
};

export function renderGroupsPage(groups: GroupItem[]): string {
  return `
    ${renderAppHeader({
      title: "Список групп",
      actions: [
      { label: "Сохранить", action: "save-report" },
      { label: "Выйти", route: "home" }],
    })}
    <main>
      <div class="wrapper">
        <div class="wrapper-title">Факультет цифровых и промышленных технологий</div>
        <div class="list">
          ${groups
            .map(
              (group) => `
                <button class="btn-group" data-group="${group.id}" data-modal="${group.modal ?? "view-mode"}">
                  <span>${group.id}</span>
                </button>
              `,
            )
            .join("")}
        </div>
      </div>
    </main>
  `;
}
