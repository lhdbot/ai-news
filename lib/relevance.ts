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

const FEEDBACK_FILE = path.join(process.cwd(), "data", "state", "feedback.json");
let feedbackCache: { mtimeMs: number; data: Record<string, string> } | null = null;

/** 本地反馈：id -> save/like/dislike；文件缺失返回空表 */
function getFeedback(): Record<string, string> {
  try {
    const stat = fs.statSync(FEEDBACK_FILE);
    if (feedbackCache && feedbackCache.mtimeMs === stat.mtimeMs) return feedbackCache.data;
    const raw = JSON.parse(fs.readFileSync(FEEDBACK_FILE, "utf-8")) as {
      items?: Record<string, { action?: string }>;
    };
    const map: Record<string, string> = {};
    for (const [id, value] of Object.entries(raw.items ?? {})) {
      if (value && typeof value.action === "string") map[id] = value.action;
    }
    feedbackCache = { mtimeMs: stat.mtimeMs, data: map };
    return map;
  } catch {
    return {};
  }
}

const PROFILE_CANDIDATES = [
  path.join(process.cwd(), ".local", "profile.json"),
  // 兼容旧位置（历史版本放在 data/，已从 git 移除）
  path.join(process.cwd(), "data", "profile.json"),
];

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
  for (const file of PROFILE_CANDIDATES) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
      cached = {
        stack: toStringArray(raw.stack),
        keywords: toStringArray(raw.keywords),
        goals: toStringArray(raw.goals),
        focusTrends: toStringArray(raw.focusTrends),
      };
      return cached;
    } catch {
      // 尝试下一个候选路径
    }
  }
  cached = null;
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

  const feedback = getFeedback()[item.id];
  if (feedback === "save") score += 3;
  else if (feedback === "like") score += 2;
  else if (feedback === "dislike") score -= 20;

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

/** 推荐理由（最多 3 条）：反馈、画像命中、多源报道，兜底热度 */
export function explainScore(item: NewsItem): string[] {
  const reasons: string[] = [];
  const feedback = getFeedback()[item.id];
  if (feedback === "save") reasons.push("已收藏");
  else if (feedback === "like") reasons.push("标记有用");

  const profile = getProfile();
  if (profile) {
    const haystack = [item.title, item.title_zh, item.summary_zh, ...item.tags]
      .join("\n")
      .toLowerCase();
    const stackHits = profile.stack
      .filter((keyword) => haystack.includes(keyword.toLowerCase()))
      .slice(0, 2);
    if (stackHits.length > 0) reasons.push(`命中技术栈：${stackHits.join("、")}`);
    const trendHits = (item.trends ?? []).filter((trend) => profile.focusTrends.includes(trend)).slice(0, 2);
    if (trendHits.length > 0) reasons.push(`关注趋势：${trendHits.join("、")}`);
  }

  const sourceCount = (item.relatedSources?.length ?? 0) + 1;
  if (sourceCount > 1) reasons.push(`${sourceCount} 源报道`);
  if (reasons.length === 0) reasons.push(`热度 ${item.heat ?? 10}`);
  return reasons.slice(0, 3);
}
