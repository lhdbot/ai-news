import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const CATEGORIES = [
  "模型发布",
  "论文研究",
  "行业动态",
  "工具产品",
  "芯片算力",
  "具身智能",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const NewsItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  title_zh: z.string().default(""),
  summary_zh: z.string().default(""),
  why_it_matters: z.string().default(""),
  learn: z.string().default(""),      // 你可以从中学到什么
  impact: z.string().default(""),     // 影响
  advice: z.string().default(""),     // 对你的建议
  url: z.string(),
  source: z.string(),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()).default([]),
  published_at: z.string(),
  summarized: z.boolean().default(false),
});

export const DailyNewsSchema = z.object({
  date: z.string(),
  generated_at: z.string(),
  items: z.array(NewsItemSchema),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;
export type DailyNews = z.infer<typeof DailyNewsSchema>;

const NEWS_DIR = path.join(process.cwd(), "data", "news");

function readDaily(date: string): DailyNews | null {
  const file = path.join(NEWS_DIR, `${date}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf-8"));
    return DailyNewsSchema.parse(raw);
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
    return null;
  }
}

/** 全部日期，倒序（最新在前） */
export function getAllDates(): string[] {
  if (!fs.existsSync(NEWS_DIR)) return [];
  return fs
    .readdirSync(NEWS_DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ""))
    .sort()
    .reverse();
}

export function getNewsByDate(date: string): DailyNews | null {
  return readDaily(date);
}

/** 最新一天的日报；没有任何数据时返回 null */
export function getLatestNews(): DailyNews | null {
  const [latest] = getAllDates();
  return latest ? readDaily(latest) : null;
}

/** 全部标签及出现次数，按次数倒序 */
export function getAllTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const date of getAllDates()) {
    const daily = readDaily(date);
    if (!daily) continue;
    for (const item of daily.items) {
      for (const tag of item.tags) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/** 某个标签下的全部条目（新日期在前） */
export function getItemsByTag(tag: string): { date: string; item: NewsItem }[] {
  const result: { date: string; item: NewsItem }[] = [];
  for (const date of getAllDates()) {
    const daily = readDaily(date);
    if (!daily) continue;
    for (const item of daily.items) {
      if (item.tags.includes(tag)) result.push({ date, item });
    }
  }
  return result;
}

export function formatDateCN(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}
