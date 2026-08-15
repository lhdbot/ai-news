import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsCard from "@/components/NewsCard";
import { getAllTags, getItemsByTag } from "@/lib/news";

export function generateStaticParams() {
  return getAllTags().map(({ tag }) => ({ tag }));
}

// 数据由巡检任务更新：动态渲染，请求时读取最新数据文件，新标签无需重建即可访问
// （标签为中文路径，动态渲染在 Windows next start 下按请求路由，不受预渲染 404 问题影响）
export const dynamic = "force-dynamic";

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
