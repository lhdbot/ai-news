import fs from "node:fs";
import path from "node:path";

/** daily = 三日滚动预测（每天 10:00）；weekly = 七天周报预测（每周一 08:00） */
export type ForecastKind = "daily" | "weekly";

const FORECAST_ROOT = path.join(process.cwd(), "data", "forecasts");

function dirFor(kind: ForecastKind): string {
  return path.join(FORECAST_ROOT, kind);
}

export interface ForecastMeta {
  date: string;
}

/** 全部预测日期，倒序（最新在前） */
export function getAllForecasts(kind: ForecastKind): ForecastMeta[] {
  const dir = dirFor(kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.replace(/\.md$/, "") }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getForecastByDate(
  kind: ForecastKind,
  date: string,
): { date: string; markdown: string } | null {
  const file = path.join(dirFor(kind), `${date}.md`);
  if (!fs.existsSync(file)) return null;
  return { date, markdown: fs.readFileSync(file, "utf-8") };
}

export function getLatestForecast(
  kind: ForecastKind,
): { date: string; markdown: string } | null {
  const [latest] = getAllForecasts(kind);
  return latest ? getForecastByDate(kind, latest.date) : null;
}

// ---- 历史预测应验度（data/forecasts/review/，目录可能不存在） ----

const REVIEW_DIR = path.join(FORECAST_ROOT, "review");

/** 全部应验度报告日期，倒序（最新在前）；目录不存在返回 [] */
export function getAllReviews(): ForecastMeta[] {
  if (!fs.existsSync(REVIEW_DIR)) return [];
  return fs
    .readdirSync(REVIEW_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.replace(/\.md$/, "") }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getReviewByDate(
  date: string,
): { date: string; markdown: string } | null {
  const file = path.join(REVIEW_DIR, `${date}.md`);
  if (!fs.existsSync(file)) return null;
  return { date, markdown: fs.readFileSync(file, "utf-8") };
}
