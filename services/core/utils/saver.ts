// utils/saver.ts
import { save, confirm, message } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { PipelineResult } from "../types.ts";

// 🔒 Храним данные пайплайна в памяти приложения
let pipelineResult: PipelineResult | null = null;

export function setPipelineData(data: PipelineResult) {
  pipelineResult = data;
}

// 🟢 Единый механизм сохранения с подтверждением
export async function requestSave(): Promise<boolean> {
  if (!pipelineResult) {
    await message("Нет собранных данных для сохранения.", { title: "Внимание", kind: "warning" });
    return false;
  }

  // 1. Спрашиваем, хочет ли пользователь сохранять
  const shouldSave = await confirm("Сохранить отчёт посещаемости в JSON?", {
    title: "Сохранение данных",
    okLabel: "Сохранить",
    cancelLabel: "Отмена"
  });

  if (!shouldSave) return false;

  // 2. Открываем системный диалог выбора пути
  const filePath = await save({
    title: "Сохранить отчёт",
    filters: [{ name: "JSON Report", extensions: ["json"] }],
    defaultPath: `attendance_report_${new Date().toISOString().slice(0, 10)}.json`
  });

  if (!filePath) return false; // Пользователь закрыл диалог сохранения

  // 3. Записываем файл
  try {
    const payload = JSON.stringify(pipelineResult, null, 2);
    await writeTextFile(filePath, payload);
    console.log(` Отчёт успешно сохранён:\n${filePath}`);
    return true;
  } catch (err) {
    console.log(` Ошибка записи: ${err}`);
    return false;
  }
}

// 🔴 Обработчик закрытия окна (вызывается автоматически)
export async function handleCloseWindow() {
  const saved = await requestSave();
  if (saved || !pipelineResult) {
    // Если сохранили успешно или данных не было → закрываем
    getCurrentWindow().close();
  }
  // Иначе → оставляем окно открытым (пользователь нажал "Отмена")
}

// 🖱️ Обработчик кнопки в UI
export async function handleSaveButton() {
  await requestSave(); // Диалог сам обработает все сценарии
}
