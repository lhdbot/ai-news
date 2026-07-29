import Link from "next/link";
import NewsCard from "@/components/NewsCard";
import CategorySection from "@/components/CategorySection";
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
  const byCategory = new Map<string, typeof rest>();
  for (const item of rest) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  return (
    <div className="py-8">
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
  );
}
