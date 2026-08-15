import fs from "node:fs";
import path from "node:path";
import type { NewsItem } from "./news";

/** data/profile.json：个人画像，用于相关度打分；文件可能不存在 */
export interface Profile {
  stack: string[];
  keywords: string[];
  goals: string[];
  focusTrends: string[];
}

const PROFILE_FILE = path.join(process.cwd(), "data", "profile.json");

// undefined = 未读取；null = 缺失/解析失败
let cached: Profile | null | undefined;

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string" && v.length > 0)
    : [];
}

/** 读取个人画像；缺失或解析失败返回 null（打分时只按 heat 兜底） */
export function getProfile(): Profile | null {
  if (cached !== undefined) return cached;
  try {
    const raw = JSON.parse(fs.readFileSync(PROFILE_FILE, "utf-8"));
    cached = {
      stack: toStringArray(raw.stack),
      keywords: toStringArray(raw.keywords),
      goals: toStringArray(raw.goals),
      focusTrends: toStringArray(raw.focusTrends),
    };
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * 相关度打分：
 *   基础分 = item.heat ?? 10
 *   + stack 关键词命中（title/title_zh/summary_zh/tags 不区分大小写包含）× 4
 *   + keywords 命中 × 2
 *   + item.trends 命中 focusTrends × 3
 * profile 缺失时只返回基础分。
 */
export function scoreItem(item: NewsItem): number {
  let score = item.heat ?? 10;
  const profile = getProfile();
  if (!profile) return score;

  const haystack = [item.title, item.title_zh, item.summary_zh, ...item.tags]
    .join("\n")
    .toLowerCase();

  for (const kw of profile.stack) {
    if (haystack.includes(kw.toLowerCase())) score += 4;
  }
  for (const kw of profile.keywords) {
    if (haystack.includes(kw.toLowerCase())) score += 2;
  }
  const trends = item.trends ?? [];
  for (const t of profile.focusTrends) {
    if (trends.includes(t)) score += 3;
  }
  return score;
}

/** 相关度星级 1-5 分档 */
export function starsOf(score: number): number {
  if (score >= 30) return 5;
  if (score >= 22) return 4;
  if (score >= 15) return 3;
  if (score >= 10) return 2;
  return 1;
}
