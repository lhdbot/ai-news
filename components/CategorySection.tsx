import type { Category, NewsItem } from "@/lib/news";
import { CATEGORY_SLUGS } from "@/lib/news";
import NewsCard from "./NewsCard";

const PREVIEW_COUNT = 6;

/** 首页板块预览：横向滑动条 + 「查看全部」进独立板块页 */
export default function CategorySection({
  category,
  items,
}: {
  category: Category;
  items: NewsItem[];
}) {
  const preview = items.slice(0, PREVIEW_COUNT);
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-lg font-bold">
            <span className="mr-2 text-accent">#</span>
            {category}
          </h2>
          <span className="text-sm text-muted">{items.length} 条</span>
        </div>
        <a
          href={`/category/${CATEGORY_SLUGS[category]}`}
          className="shrink-0 text-sm text-muted transition-colors hover:text-accent"
        >
          查看全部 →
        </a>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/60 px-4 py-6 text-center text-sm text-muted">
          今日暂无该板块内容
        </p>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          <div className="flex snap-x snap-mandatory gap-3">
            {preview.map((item) => (
              <div
                key={item.id}
                className="w-72 shrink-0 snap-start md:w-80"
              >
                <NewsCard item={item} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
