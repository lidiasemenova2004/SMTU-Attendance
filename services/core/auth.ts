import * as cheerio from "cheerio";
import { SessionManager } from "./session.ts";

export async function loginISU(
  email: string,
  password: string,
  session: SessionManager
): Promise<void> {
  console.log("Начало авторизации...");

  let loginRes;
  try {
    loginRes = await session.request("https://isu.smtu.ru/login/");
  } catch (err) {
    console.error("Ошибка при запросе страницы входа:", err);
    throw new Error(`Не удалось загрузить страницу входа: ${err instanceof Error ? err.message : String(err)}`);
  }

  const html = await loginRes.text();
  const $ = cheerio.load(html);
  const formNum = $('input[name="form_num"]').attr("value");
  if (!formNum) throw new Error("Не удалось найти скрытое поле form_num на странице входа");

  const formData = new URLSearchParams();
  formData.append('form_num', formNum);
  formData.append('login', email);
  formData.append('password', password);

  $('input[type="hidden"]').each((_, el) => {
    const name = $(el).attr('name');
    const value = $(el).attr('value');
    if (name && name !== 'form_num') {
      formData.append(name, value ?? '');
    }
  });

  let postRes;
  try {
    postRes = await session.request("https://isu.smtu.ru/login/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Referer": "https://isu.smtu.ru/login/",
      },
      body: formData,
    });
    console.log("Ответ на POST, статус:", postRes.status);
  } catch (err) {
    console.error("Ошибка при отправке формы авторизации:", err);
    throw new Error(`Ошибка сети при попытке входа: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (postRes.redirected) {
    console.log("Успешный вход (редирект)");
    return;
  }

  let responseText;
  try {
    responseText = await postRes.text();
  } catch (err) {
    throw new Error("Не удалось прочитать ответ сервера после попытки входа");
  }

  const $response = cheerio.load(responseText);

  if ($response('input[name="form_num"]').length === 0) {
    console.log("Успешный вход (страница личного кабинета)");
    return;
  }

  const errorText = $response('.alert-danger, .error, .text-danger').first().text().trim();
  if (errorText) {
    throw new Error(errorText);
  }

  throw new Error("Неверный логин или пароль (форма входа показана повторно)");
}