import type { NewsItem } from "@/lib/news";
import NewsCard from "./NewsCard";

export default function CategorySection({
  category,
  items,
}: {
  category: string;
  items: NewsItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-lg font-bold">
          <span className="mr-2 text-accent">#</span>
          {category}
        </h2>
        <span className="text-sm text-muted">{items.length} 条</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>
    </section>
  );
}
