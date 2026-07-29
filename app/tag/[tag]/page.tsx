import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsCard from "@/components/NewsCard";
import { getAllTags, getItemsByTag } from "@/lib/news";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ tag }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag } = await params;
  return {
    title: `#${decodeURIComponent(tag)}`,
    description: `标签「${decodeURIComponent(tag)}」下的 AI 资讯`,
  };
}

export default async function TagPage({
  params,
}: {
  params: Promise<{ tag: string }>;
}) {
  const { tag: rawTag } = await params;
  const tag = decodeURIComponent(rawTag);
  const entries = getItemsByTag(tag);
  if (entries.length === 0) notFound();

  return (
    <div className="py-8">
      <Link
        href="/"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        ← 返回首页
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
        <span className="text-accent">#</span>
        {tag}
      </h1>
      <p className="mt-2 text-muted">共 {entries.length} 条相关资讯</p>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ date, item }) => (
          <div key={`${date}-${item.id}`}>
            <p className="mb-1.5 text-xs text-muted">{date}</p>
            <NewsCard item={item} />
          </div>
        ))}
      </div>
    </div>
  );
}
