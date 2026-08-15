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

// 板块页 URL 使用英文 slug：Windows 下 next start 无法匹配非 ASCII 的
// 预渲染路由（中文路径 404），因此用 slug 做映射，页面内仍展示中文名。
export const CATEGORY_SLUGS: Record<Category, string> = {
  模型发布: "models",
  论文研究: "papers",
  行业动态: "industry",
  工具产品: "tools",
  芯片算力: "chips",
  具身智能: "embodied",
};

export function categoryFromSlug(slug: string): Category | undefined {
  return CATEGORIES.find((c) => CATEGORY_SLUGS[c] === slug);
}

/** 六分类主题色（情报面板/板块卡片/徽标共用，对齐 designs/ai-news-home-v1.html） */
export const CATEGORY_COLORS: Record<Category, string> = {
  模型发布: "#8b6cff",
  论文研究: "#4d9fff",
  行业动态: "#ffb03a",
  工具产品: "#2fd4e8",
  芯片算力: "#ff6b6b",
  具身智能: "#c084fc",
};

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
  // 以下为趋势/热度扩展字段，旧数据没有，全部 optional
  trends: z.array(z.string()).optional(),
  heat: z.number().optional(),
  relatedSources: z
    .array(z.object({ source: z.string(), url: z.string() }))
    .optional(),
  method: z.string().optional(),
  result: z.string().optional(),
  limitation: z.string().optional(),
  // 收录进日报的时间（抓取批次时间戳），用于前端标注"今日新增"；旧数据没有
  added_at: z.string().optional(),
});

export const DailyNewsSchema = z.object({
  date: z.string(),
  generated_at: z.string(),
  items: z.array(NewsItemSchema),
});

export type NewsItem = z.infer<typeof NewsItemSchema>;
export type DailyNews = z.infer<typeof DailyNewsSchema>;

const NEWS_DIR = path.join(process.cwd(), "data", "news");

// mtime 键控的解析缓存：构建期 getAllTags/getItemsByTag/搜索页会反复读取同一批文件，
// 数据文件只在巡检后变化，mtime 不变即可安全复用解析结果。
const dailyCache = new Map<string, { mtimeMs: number; data: DailyNews | null }>();

function readDaily(date: string): DailyNews | null {
  const file = path.join(NEWS_DIR, `${date}.json`);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return null; // 文件不存在（不缓存，之后创建了也能读到）
  }
  const hit = dailyCache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;
  let data: DailyNews | null = null;
  try {
    // 容忍 UTF-8 BOM（部分编辑器/脚本会写入），JSON.parse 不接受 BOM
    const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
    data = DailyNewsSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
  }
  dailyCache.set(file, { mtimeMs, data });
  return data;
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

/**
 * 当日"最新一轮收录"的条目 id 集合：
 * 取全部 added_at 的最大值，往前 40 分钟（覆盖一个巡检间隔 30 分钟）内的算新批次。
 * 旧数据没有 added_at 时返回空集（不显示"今日新增"徽标）。
 */
export function getLatestBatchIds(items: NewsItem[]): {
  ids: Set<string>;
  latestAt: string | null;
} {
  let max = 0;
  for (const it of items) {
    const t = it.added_at ? Date.parse(it.added_at) : NaN;
    if (!Number.isNaN(t) && t > max) max = t;
  }
  if (!max) return { ids: new Set(), latestAt: null };
  const cutoff = max - 40 * 60 * 1000;
  const ids = new Set<string>();
  for (const it of items) {
    const t = it.added_at ? Date.parse(it.added_at) : NaN;
    if (!Number.isNaN(t) && t >= cutoff) ids.add(it.id);
  }
  return { ids, latestAt: new Date(max).toISOString() };
}

export function formatDateCN(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${y} 年 ${m} 月 ${d} 日`;
}
