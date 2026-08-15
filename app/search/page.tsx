import type { Metadata } from "next";
import SearchClient from "@/components/SearchClient";
import { getAllDates, getNewsByDate } from "@/lib/news";

export const metadata: Metadata = {
  title: "搜索",
  description: "检索全部历史日报：按标题、中文标题、摘要、标签即时过滤。",
};

export default function SearchPage() {
  // 构建期读全部日报，生成索引数组传给客户端组件。
  // 同一 URL 因 48h 抓取窗口会跨天重复收录（近 3 天约 46%），只保留最新一天，避免搜索结果重复。
  const items = [];
  const seenUrls = new Set();
  for (const date of getAllDates()) {
    const daily = getNewsByDate(date);
    if (!daily) continue;
    for (const item of daily.items) {
      if (seenUrls.has(item.url)) continue;
      seenUrls.add(item.url);
      items.push({
        date,
        title: item.title,
        title_zh: item.title_zh,
        summary_zh: item.summary_zh,
        tags: item.tags,
        url: item.url,
        source: item.source,
      });
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">搜索</h1>
      <p className="mt-2 text-sm text-muted">
        共收录 {items.length} 条（跨天去重后），按标题 / 中文标题 / 摘要 / 标签即时过滤。
      </p>
      <SearchClient items={items} />
    </main>
  );
}
