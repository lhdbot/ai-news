import fs from "node:fs";
import path from "node:path";

const FORECAST_DIR = path.join(process.cwd(), "data", "forecasts");

export interface ForecastMeta {
  date: string;
}

/** 全部预测日期，倒序（最新在前） */
export function getAllForecasts(): ForecastMeta[] {
  if (!fs.existsSync(FORECAST_DIR)) return [];
  return fs
    .readdirSync(FORECAST_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.replace(/\.md$/, "") }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getForecastByDate(date: string): { date: string; markdown: string } | null {
  const file = path.join(FORECAST_DIR, `${date}.md`);
  if (!fs.existsSync(file)) return null;
  return { date, markdown: fs.readFileSync(file, "utf-8") };
}

export function getLatestForecast(): { date: string; markdown: string } | null {
  const [latest] = getAllForecasts();
  return latest ? getForecastByDate(latest.date) : null;
}
