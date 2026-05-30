import * as cheerio from "cheerio";
import retry from "fetch-retry";
import { chunk } from "../utils/chunk.ts";

export type Lesson = {
  timeIn: string,
  timeOut: string,
  week: string;
  group: string;
  subject: string;
  kind: string;
  teacher: string;
  building: string;
  audience: string;
};

export type Schedule = Record<string, Record<string, Array<Lesson[] | undefined>>>;

export type GroupSubjects = Record<string, string[]>;

const WEBSITE_HOST = "https://www.smtu.ru";

// Словарь известных корпусов (включая составные названия)
const KNOWN_BUILDINGS = [
  "Корпус У", "Корпус Б", "Корпус А", "Корпус Г", "Корпус М",
  "Конгресс-Центр",
  "Гребная база",
  "Спортивный комплекс",
  "ИЛИСТ",
  "ЦДО",
  "Практика",
  // можно добавлять другие по мере обнаружения
];

/** Разбирает строку вида "Гребная база 12" или "У 414" на корпус и аудиторию */
function parseBuildingAndAudience(text: string): { building: string; audience: string } {
  // Сортируем по убыванию длины, чтобы длинные названия проверялись первыми
  const sortedBuildings = [...KNOWN_BUILDINGS].sort((a, b) => b.length - a.length);
  for (const b of sortedBuildings) {
    if (text.startsWith(b)) {
      const audience = text.slice(b.length).trim();
      return { building: b, audience: audience || "—" };
    }
  }
  // Fallback: первое слово — корпус, остальное — аудитория
  const [first, ...rest] = text.split(" ");
  return { building: first, audience: rest.join(" ") || "—" };
}

async function listSchedule(f: typeof fetch) {
  const res = await retry(f)(`${WEBSITE_HOST}/ru/listschedule/`, {
    retries: 3,
    retryDelay: 1000,
    //signal: AbortSignal.timeout(15000),
  });
  const html = await res.text();
  const $ = cheerio.load(html);

  const hrefs = $('a[href^="/ru/viewschedule"]')
    .map((_, a) => a.attribs.href)
    .toArray();

  return hrefs;
}

function fetchSchedules(
  f: typeof fetch,
  hrefs: string[],
  options?: { onResponse?: (res: Response) => void },
) {
  const { onResponse } = options ?? {};

  return chunk(hrefs, 10, async (href) => {
    const res = await retry(f)(`${WEBSITE_HOST}${href}`, {
      retries: 3,
      retryDelay: 1000,
      //signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    onResponse?.(res);

    const $ = cheerio.load(html);
    // Ищем h1 внутри main или section
    const h1 = $('main h1').first().text().trim() || $('section h1').first().text().trim();
    console.log(`h1 text for ${href}: "${h1}"`);

    const match = h1.match(/группы\s+([0-9]+[А-Яа-яA-Za-z]*)/i);
    const group = match ? match[1] : href.replace(/[^0-9]/g, '');

    console.log(`URL: ${href} -> Group: ${group}`);
    return [group, $] as const;
  });
}

function parse(schedules: (readonly [string, cheerio.CheerioAPI])[]) {
  const dayMap: Record<string, number> = {
    "Понедельник": 0,
    "Вторник": 1,
    "Среда": 2,
    "Четверг": 3,
    "Пятница": 4,
    "Суббота": 5,
  };

  return schedules.map(([group, $]) => {
    const container = $("#table-container").length ? $("#table-container") : $("#card-container");
    const days: Lesson[][] = Array.from({ length: 6 }, () => []);

    container.find(".card").each((_, card) => {
      const $card = $(card);
      const headerText = $card.find(".card-header").text().trim();
      const dayName = Object.keys(dayMap).find(d => headerText.includes(d));
      if (!dayName) return;
      const dayIndex = dayMap[dayName];

      $card.find("tbody tr").each((_, row) => {
        const cols = $(row).find("td, th");
        if (cols.length < 5) return;

        const timeText = $(cols[0]).text().trim();
        const [start, end] = timeText.split("-");
        if (!start || !end) return;

        const weekAttr = $(cols[1]).children().attr()?.["data-bs-title"];
        const rawLocation = $(cols[2]).text().trim();
        const { building, audience } = parseBuildingAndAudience(rawLocation);
        const subject = $(cols[4]).children().first().text().trim();
        const kind = $(cols[4]).children("small").first().text().trim();
        const teacher = $(cols[5]).text().trim();

        days[dayIndex].push({
          timeIn: start,
          timeOut: end,
          week: weekAttr == "Верхняя неделя" ? "up" : weekAttr == "Нижняя неделя" ? "down" : "both",
          building,
          audience,
          subject,
          kind: kind == "Практическое занятие" ? "practice" : kind == "Лекция" ? "lecture" : "lab",
          teacher,
          group, // <-- добавили group
        } as Lesson);
      });
    });

    // Fallback на старый метод, если новый не дал результатов
    if (container.length === 0 || days.every(d => d.length === 0)) {
      const tbodies = $("tbody");
      tbodies.each((idx, tbody) => {
        if (idx >= 6) return;
        $(tbody).find("tr").each((_, row) => {
          const cols = $(row).find("td, th");
          if (cols.length < 5) return;
          const timeText = $(cols[0]).text().trim();
          const [start, end] = timeText.split("-");
          if (!start || !end) return;
          const weekAttr = $(cols[1]).children().attr()?.["data-bs-title"];
          const rawLocation = $(cols[2]).text().trim();
          const { building, audience } = parseBuildingAndAudience(rawLocation);
          const subject = $(cols[4]).children().first().text().trim();
          const kind = $(cols[4]).children("small").first().text().trim();
          const teacher = $(cols[5]).text().trim();
          days[idx].push({
          timeIn: start,
          timeOut: end,
            week: weekAttr == "Верхняя неделя" ? "up" : weekAttr == "Нижняя неделя" ? "down" : "both",
            building,
            audience,
            subject,
            kind: kind == "Практическое занятие" ? "practice" : kind == "Лекция" ? "lecture" : "lab",
            teacher,
            group, // <-- добавили group
          } as Lesson);
        });
      });
    }

    return [group, ...days] as const;
  });
}

/* function transform(
  ast: ReturnType<typeof parse>,
) {
  const schedule = ast.reduce(
    (acc, [group, ...days]) => {
      for (let i = 0; i < days.length; i++) {
        for (const lesson of days[i]) {
          const { building, audience, subject, kind, teacher, time, week } = lesson;

          acc[building] ??= {};
          acc[building][audience] ??= new Array(6);
          acc[building][audience][i] ??= [];
          acc[building][audience][i]?.push({
            group,
            subject,
            kind,
            teacher,
            time,
            week,
            building,
            audience,
          });
        }
      }
      return acc;
    },
    {} as Schedule,
  );

  for (const building of Object.keys(schedule)) {
    for (const audience of Object.keys(schedule[building])) {
      schedule[building][audience] = schedule[building][audience].map(
        (dayLessons) => {
          const map: Record<string, Lesson> = {};

          for (const les of dayLessons ?? []) {
            const key = [les.time, les.subject, les.kind, les.teacher, les.week]
              .join("|");
            if (!map[key]) {
              map[key] = { ...les, group: les.group };
            } else {
              map[key].group = `${map[key].group}, ${les.group}`;
            }
          }

          return Object.values(map).sort((a, b) =>
            a.time.localeCompare(b.time)
          );
        },
      );
    }
  }

  return schedule;
}
 */
function splitGroups(value: string): string[] {
  return value
    .split(",")
    .map((group) => group.trim())
    .filter(Boolean);
}

export function getGroupsAndSubjects(schedule: Schedule): GroupSubjects {
  const index: Record<string, Set<string>> = {};

  for (const audiences of Object.values(schedule)) {
    for (const days of Object.values(audiences)) {
      for (const lessons of days) {
        if (!lessons) continue;

        for (const lesson of lessons) {
          if (!lesson.subject) continue;

          for (const group of splitGroups(lesson.group)) {
            index[group] ??= new Set<string>();
            index[group].add(lesson.subject);
          }
        }
      }
    }
  }

  return Object.fromEntries(
    Object.entries(index)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, subjects]) => [
        group,
        Array.from(subjects).sort((a, b) => a.localeCompare(b)),
      ]),
  );
}

export function getScheduleGroups(schedule: Schedule): string[] {
  return Object.keys(getGroupsAndSubjects(schedule));
}
/* 
export async function buildSchedule(
  f: typeof fetch,
  options?: { onProgress?: (pct: number) => void },
): Promise<Schedule> {
  const { onProgress } = options ?? {};

  const hrefs = await listSchedule(f);

  let nFinished = 0;

  const schedules = await fetchSchedules(f, hrefs, {
    onResponse() {
      nFinished += 1;
      onProgress?.(Math.round(100 * nFinished / hrefs.length));
    },
  });
  const schedule = transform(parse(schedules));

  return schedule;
} */
/* 
export async function buildGroupsAndSubjects(
  f: typeof fetch,
  options?: { onProgress?: (pct: number) => void },
): Promise<GroupSubjects> {
  const schedule = await buildSchedule(f, options);
  return getGroupsAndSubjects(schedule);
} */

export {parse};

export async function buildGroupSchedule(
  f: typeof fetch,
  options?: { onProgress?: (pct: number) => void },
){
  const {onProgress} = options ?? {};
  const hrefs = await listSchedule(f);

  let nFinished = 0;

  const schedules = await fetchSchedules(f, hrefs, {
    onResponse() {
      nFinished += 1;
      onProgress?.(Math.round(100 * nFinished / hrefs.length));
    },
  });

  return parse(schedules);
}