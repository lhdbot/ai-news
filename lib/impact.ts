import fs from "node:fs";
import path from "node:path";

const IMPACT_DIR = path.join(process.cwd(), "data", "impact");

export interface ImpactMeta {
  date: string;
}

/** 全部影响分析日期，倒序（最新在前） */
export function getAllImpacts(): ImpactMeta[] {
  if (!fs.existsSync(IMPACT_DIR)) return [];
  return fs
    .readdirSync(IMPACT_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.replace(/\.md$/, "") }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getImpactByDate(date: string): { date: string; markdown: string } | null {
  const file = path.join(IMPACT_DIR, `${date}.md`);
  if (!fs.existsSync(file)) return null;
  return { date, markdown: fs.readFileSync(file, "utf-8") };
}

export function getLatestImpact(): { date: string; markdown: string } | null {
  const [latest] = getAllImpacts();
  return latest ? getImpactByDate(latest.date) : null;
}
