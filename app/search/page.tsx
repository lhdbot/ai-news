import type { Metadata } from "next";
import { getAllDates, getNewsByDate } from "@/lib/news";

export const metadata: Metadata = {
  title: "搜索",
  description: "检索全部历史日报：按标题、中文标题、摘要、标签过滤。",
};

// 数据由巡检任务更新：请求时读取，无需重建
export const dynamic = "force-dynamic";

const MAX_RESULTS = 50;

interface SearchItem {
  date: string;
  title: string;
  title_zh: string;
  summary_zh: string;
  tags: string[];
  url: string;
  source: string;
}

/** 跨天按 URL 去重后的轻量索引；摘要只保留 160 字 */
function buildIndex(): SearchItem[] {
  const items: SearchItem[] = [];
  const seen = new Set<string>();
  for (const date of getAllDates()) {
    const daily = getNewsByDate(date);
    if (!daily) continue;
    for (const item of daily.items) {
      if (seen.has(item.url)) continue;
      seen.add(item.url);
      items.push({
        date,
        title: item.title,
        title_zh: item.title_zh,
        summary_zh: item.summary_zh.slice(0, 160),
        tags: item.tags,
        url: item.url,
        source: item.source,
      });
    }
  }
  return items;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const items = buildIndex();
  const lower = query.toLowerCase();
  const matched = lower
    ? items.filter((item) =>
        [item.title, item.title_zh, item.summary_zh, ...item.tags]
          .join("\n")
          .toLowerCase()
          .includes(lower),
      )
    : [];
  const results = matched.slice(0, MAX_RESULTS);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">搜索</h1>
      <p className="mt-2 text-sm text-muted">
        共收录 {items.length} 条（跨天去重后），按标题 / 中文标题 / 摘要 / 标签检索。
      </p>

      <form action="/search" method="get" role="search" className="mt-6 flex gap-2">
        <label htmlFor="q" className="sr-only">
          搜索新闻
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="输入关键词，如：Agent、RAG、vLLM…"
          autoFocus
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent/60"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl border border-border bg-surface-2 px-5 text-sm text-fg transition-colors hover:border-accent/60"
        >
          搜索
        </button>
      </form>

      {query && (
        <p className="mt-3 text-xs text-muted">
          命中 {matched.length} 条
          {matched.length > MAX_RESULTS ? `，显示前 ${MAX_RESULTS} 条` : ""}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {results.map((item) => (
          <li
            key={item.date + "-" + item.url}
            className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{item.date}</span>
              <span className="font-medium text-fg/70">{item.source}</span>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold leading-snug transition-colors hover:text-accent"
            >
              {item.title_zh || item.title}
            </a>
            {item.summary_zh && (
              <p className="mt-1.5 text-xs leading-normal text-muted line-clamp-2">
                {item.summary_zh}
              </p>
            )}
            {item.tags.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted/70">
                {item.tags.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {query && results.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          没有匹配的条目，换个关键词试试。
        </p>
      )}
    </main>
  );
}
