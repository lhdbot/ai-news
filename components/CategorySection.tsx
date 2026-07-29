import type { NewsItem } from "@/lib/news";
import NewsCard from "./NewsCard";

/** 分类锚点 id（供左侧快速导航跳转） */
export function categoryAnchor(category: string): string {
  return `cat-${encodeURIComponent(category)}`;
}

export default function CategorySection({
  category,
  items,
}: {
  category: string;
  items: NewsItem[];
}) {
  return (
    <section id={categoryAnchor(category)} className="mt-10 scroll-mt-20">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-bold">
          <span className="mr-2 text-accent">#</span>
          {category}
        </h2>
        <span className="text-sm text-muted">{items.length} 条</span>
      </div>
      {items.length === 0 ? (
        <p className="rounded-xl border border-border/60 border-dashed px-4 py-6 text-center text-sm text-muted">
          今日暂无该板块内容
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
