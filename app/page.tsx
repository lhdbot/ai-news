import Link from "next/link";
import NewsCard from "@/components/NewsCard";
import CategorySection from "@/components/CategorySection";
import CategoryNav from "@/components/CategoryNav";
import { CATEGORIES, formatDateCN, getLatestBatchIds, getLatestNews, type NewsItem } from "@/lib/news";
import { scoreItem, starsOf } from "@/lib/relevance";

// 数据由巡检任务更新：动态渲染，请求时读取最新数据文件，无需整站重建/重启
export const dynamic = "force-dynamic";

function starText(score: number): string {
  const n = starsOf(score);
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function TopPickCard({ item, rank }: { item: NewsItem; rank: number }) {
  const score = scoreItem(item);
  const displayTitle = item.title_zh || item.title;
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60"
    >
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-bold text-accent">#{rank}</span>
        <span className="text-amber-300" title={`相关度 ${score}`}>
          {starText(score)}
        </span>
      </div>
      <h3 className="text-sm font-bold leading-snug line-clamp-2 transition-colors group-hover:text-accent">
        {displayTitle}
      </h3>
      <p className="mt-1 text-xs text-muted">{item.source}</p>
      {item.summary_zh && (
        <p className="mt-2 text-xs leading-normal text-muted line-clamp-2">
          {item.summary_zh}
        </p>
      )}
    </a>
  );
}

export default function HomePage() {
  const daily = getLatestNews();

  if (!daily || daily.items.length === 0) {
    return (
      <div className="py-24 text-center">
        <h1 className="text-2xl font-bold">暂无内容</h1>
        <p className="mt-3 text-muted">
          还没有抓取到新闻。运行{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5 text-accent">
            node scripts/fetch-news.mjs
          </code>{" "}
          生成第一期日报。
        </p>
      </div>
    );
  }

  const [headline, ...rest] = daily.items;
  // 最新一轮收录批次（"今日新增"徽标）
  const { ids: newIds, latestAt } = getLatestBatchIds(daily.items);
  // 与你最相关 TOP 5：按相关度打分排序（分数相同保持原顺序）
  const top5 = daily.items
    .map((item, index) => ({ item, index, score: scoreItem(item) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 5);
  // 固定板块顺序（CATEGORIES），板块内按时间倒序
  const byCategory = new Map<string, typeof rest>();
  const counts: Record<string, number> = {};
  for (const category of CATEGORIES) {
    const list = rest
      .filter((item) => item.category === category)
      .sort(
        (a, b) =>
          new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
      );
    byCategory.set(category, list);
    counts[category] = list.length;
  }

  return (
    <div className="py-8 lg:flex lg:gap-8">
      <aside className="mb-6 shrink-0 lg:mb-0 lg:w-36">
        <CategoryNav counts={counts} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-accent">今日头条 · {daily.items.length} 条</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {formatDateCN(daily.date)} AI 日报
            </h1>
            {latestAt && newIds.size > 0 && (
              <p className="mt-1 text-xs text-green-300">
                ● 最新一轮新增 {newIds.size} 条（
                {new Date(latestAt).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
                收录）
              </p>
            )}
          </div>
          <Link
            href="/archive"
            className="text-sm text-muted transition-colors hover:text-accent"
          >
            查看历史归档 →
          </Link>
        </div>

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-bold">
            今日与你最相关 TOP 5
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {top5.map(({ item }, i) => (
              <TopPickCard key={item.id} item={item} rank={i + 1} />
            ))}
          </div>
        </section>

        <NewsCard item={headline} featured isNew={newIds.has(headline.id)} />

        {CATEGORIES.map((category) => (
          <CategorySection
            key={category}
            category={category}
            items={byCategory.get(category) ?? []}
            newIds={newIds}
          />
        ))}
      </div>
    </div>
  );
}
