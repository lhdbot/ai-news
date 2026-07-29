import Link from "next/link";
import NewsCard from "@/components/NewsCard";
import CategorySection, { categoryAnchor } from "@/components/CategorySection";
import { CATEGORIES, formatDateCN, getLatestNews } from "@/lib/news";

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
  // 固定板块顺序（CATEGORIES），板块内按时间倒序
  const byCategory = new Map<string, typeof rest>();
  for (const category of CATEGORIES) {
    byCategory.set(
      category,
      rest
        .filter((item) => item.category === category)
        .sort(
          (a, b) =>
            new Date(b.published_at).getTime() -
            new Date(a.published_at).getTime(),
        ),
    );
  }

  return (
    <div className="py-8 lg:flex lg:gap-8">
      {/* 左侧快速导航（大屏显示，吸顶） */}
      <aside className="mb-6 shrink-0 lg:mb-0 lg:w-36">
        <nav className="flex flex-wrap gap-1.5 text-sm lg:sticky lg:top-20 lg:flex-col lg:gap-1">
          <p className="mb-1 hidden text-xs font-semibold tracking-wider text-muted lg:block">
            快速导航
          </p>
          {CATEGORIES.map((category) => {
            const count = byCategory.get(category)?.length ?? 0;
            return (
              <a
                key={category}
                href={`#${categoryAnchor(category)}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-2.5 py-1.5 text-muted transition-colors hover:border-accent/50 hover:text-accent lg:border-0 lg:px-2"
              >
                <span>{category}</span>
                <span className="text-xs text-muted/70">{count}</span>
              </a>
            );
          })}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-accent">今日头条 · {daily.items.length} 条</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
              {formatDateCN(daily.date)} AI 日报
            </h1>
          </div>
          <Link
            href="/archive"
            className="text-sm text-muted transition-colors hover:text-accent"
          >
            查看历史归档 →
          </Link>
        </div>

        <NewsCard item={headline} featured />

        {CATEGORIES.map((category) => (
          <CategorySection
            key={category}
            category={category}
            items={byCategory.get(category) ?? []}
          />
        ))}
      </div>
    </div>
  );
}
