import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsCard from "@/components/NewsCard";
import { formatDateCN, getAllDates, getLatestBatchIds, getNewsByDate } from "@/lib/news";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllDates().map((date) => ({ date }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ date: string }>;
}): Promise<Metadata> {
  const { date } = await params;
  return {
    title: `${formatDateCN(date)} AI 日报`,
    description: `${formatDateCN(date)} 的 AI 资讯精选`,
  };
}

export default async function DailyPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const daily = getNewsByDate(date);
  if (!daily) notFound();
  const { ids: newIds } = getLatestBatchIds(daily.items);

  const dates = getAllDates();
  const idx = dates.indexOf(date);
  const prev = idx >= 0 && idx < dates.length - 1 ? dates[idx + 1] : null; // 更早一天
  const next = idx > 0 ? dates[idx - 1] : null; // 更晚一天

  return (
    <div className="py-8">
      <Link
        href="/archive"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        ← 返回归档
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">
        {formatDateCN(date)} AI 日报
      </h1>
      <p className="mt-2 text-muted">共 {daily.items.length} 条</p>

      <div className="mt-8 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {daily.items.map((item) => (
          <NewsCard key={item.id} item={item} isNew={newIds.has(item.id)} />
        ))}
      </div>

      <div className="mt-10 flex items-center justify-between text-sm">
        {prev ? (
          <Link href={`/archive/${prev}`} className="text-muted hover:text-accent">
            ← {prev}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/archive/${next}`} className="text-muted hover:text-accent">
            {next} →
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
