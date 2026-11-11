import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsCard from "@/components/NewsCard";
import { getAllTags, getItemsByTag } from "@/lib/news";

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ tag }));
}

// 数据由巡检任务更新：动态渲染，新标签无需重建即可访问
export const dynamic = "force-dynamic";

// 每页 30 条：历史热门标签（OpenAI 291 条）此前整页渲染约 1.4MB / 5s
const PAGE_SIZE = 30;

function decodeTag(raw: string): string {
  // Next 已解码过一次；这里只兜底非法百分号（如标签含 %），避免 500
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tag: string }>;
}): Promise<Metadata> {
  const { tag: rawTag } = await params;
  const tag = decodeTag(rawTag);
  return {
    title: `#${tag}`,
    description: `标签「${tag}」下的 AI 资讯`,
    alternates: { canonical: `/tag/${encodeURIComponent(tag)}` },
  };
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { tag: rawTag } = await params;
  const { page } = await searchParams;
  const tag = decodeTag(rawTag);
  const entries = getItemsByTag(tag);
  if (entries.length === 0) notFound();

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const current = Math.min(
    totalPages,
    Math.max(1, Number.parseInt(page ?? "1", 10) || 1),
  );
  const start = (current - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);
  const base = "/tag/" + encodeURIComponent(tag);
  const href = (n: number) => (n <= 1 ? base : base + "?page=" + n);

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
      <p className="mt-2 text-muted">
        共 {entries.length} 条相关资讯
        {totalPages > 1 ? " · 第 " + current + " / " + totalPages + " 页" : ""}
      </p>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {pageEntries.map(({ date, item }) => (
          <div key={date + "-" + item.id}>
            <p className="mb-1.5 text-xs text-muted">{date}</p>
            <NewsCard item={item} />
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <nav
          className="mt-8 flex items-center justify-between text-sm"
          aria-label="标签分页"
        >
          {current > 1 ? (
            <Link href={href(current - 1)} className="text-accent hover:underline">
              ← 上一页
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted">
            第 {current} / {totalPages} 页
          </span>
          {current < totalPages ? (
            <Link href={href(current + 1)} className="text-accent hover:underline">
              下一页 →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
