import type { Metadata } from "next";
import Link from "next/link";
import { formatDateCN, getAllDates, getNewsByDate } from "@/lib/news";

export const metadata: Metadata = {
  title: "归档",
  description: "按日期浏览历史 AI 日报",
};

export default function ArchivePage() {
  const dates = getAllDates();

  return (
    <div className="py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">历史归档</h1>
      <p className="mt-2 text-muted">共 {dates.length} 期日报</p>

      <div className="mt-8 flex flex-col gap-3">
        {dates.map((date) => {
          const daily = getNewsByDate(date);
          return (
            <Link
              key={date}
              href={`/archive/${date}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-accent/60"
            >
              <div>
                <p className="font-bold">{formatDateCN(date)}</p>
                <p className="mt-0.5 text-xs text-muted">{date}</p>
              </div>
              <span className="rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted">
                {daily?.items.length ?? 0} 条
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
