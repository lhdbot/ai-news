import Link from "next/link";
import { notFound } from "next/navigation";
import NewsCard from "@/components/NewsCard";
import CategoryNav from "@/components/CategoryNav";
import {
  CATEGORIES,
  CATEGORY_SLUGS,
  categoryFromSlug,
  formatDateCN,
  getLatestNews,
} from "@/lib/news";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({
    slug: CATEGORY_SLUGS[category],
  }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  return { title: category ? `${category} - AI 日报` : "AI 日报" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = categoryFromSlug(slug);
  if (!category) notFound();

  const daily = getLatestNews();
  const items = (daily?.items ?? [])
    .filter((item) => item.category === category)
    .sort(
      (a, b) =>
        new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
    );

  const counts: Record<string, number> = {};
  for (const c of CATEGORIES) {
    counts[c] = (daily?.items ?? []).filter((i) => i.category === c).length;
  }

  return (
    <div className="py-8 lg:flex lg:gap-8">
      <aside className="mb-6 shrink-0 lg:mb-0 lg:w-36">
        <CategoryNav counts={counts} active={category} />
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-6">
          <p className="text-sm text-accent">
            {daily ? formatDateCN(daily.date) : ""} · {items.length} 条
          </p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
            <span className="mr-2 text-accent">#</span>
            {category}
          </h1>
        </div>

        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border/60 px-4 py-16 text-center text-muted">
            今日该板块暂无内容，看看{" "}
            <Link href="/" className="text-accent hover:underline">
              今日总览
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
