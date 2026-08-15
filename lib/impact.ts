import fs from "node:fs";
import path from "node:path";

/** daily = 三日影响分析（每天更新）；weekly = 七天影响分析（每周一更新） */
export type ImpactKind = "daily" | "weekly";

const IMPACT_ROOT = path.join(process.cwd(), "data", "impact");

function dirFor(kind: ImpactKind): string {
  return path.join(IMPACT_ROOT, kind);
}

export interface ImpactMeta {
  date: string;
}

/** 全部影响分析日期，倒序（最新在前） */
export function getAllImpacts(kind: ImpactKind): ImpactMeta[] {
  const dir = dirFor(kind);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => ({ date: f.replace(/\.md$/, "") }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function getImpactByDate(
  kind: ImpactKind,
  date: string,
): { date: string; markdown: string } | null {
  const file = path.join(dirFor(kind), `${date}.md`);
  if (!fs.existsSync(file)) return null;
  return { date, markdown: fs.readFileSync(file, "utf-8") };
}

export function getLatestImpact(
  kind: ImpactKind,
): { date: string; markdown: string } | null {
  const [latest] = getAllImpacts(kind);
  return latest ? getImpactByDate(kind, latest.date) : null;
}
