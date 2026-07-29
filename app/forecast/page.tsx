import type { Metadata } from "next";
import { marked } from "marked";
import { getAllForecasts, getForecastByDate, getLatestForecast } from "@/lib/forecasts";
import { formatDateCN } from "@/lib/news";

export const metadata: Metadata = {
  title: "每周 AI 预测",
  description: "基于一周新闻盘点的 AI 发展方向预测，结合个人情况的行动建议。",
};

export default function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  return <ForecastBody searchParams={searchParams} />;
}

async function ForecastBody({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const all = getAllForecasts();
  const forecast = d ? getForecastByDate(d) : getLatestForecast();

  if (!forecast) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">
        <h1 className="text-2xl font-bold text-fg">每周 AI 预测</h1>
        <p className="mt-4">还没有预测报告。运行 <code>node scripts/weekly-forecast.mjs</code> 生成第一期。</p>
      </main>
    );
  }

  const html = await marked.parse(forecast.markdown, { async: true });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">每周 AI 预测</h1>
        {all.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-xs">
            {all.map(({ date }) => (
              <a
                key={date}
                href={`/forecast?d=${date}`}
                className={`rounded border px-2 py-1 transition-colors ${
                  date === forecast.date
                    ? "border-accent text-accent"
                    : "border-border text-muted hover:text-accent"
                }`}
              >
                {formatDateCN(date)}
              </a>
            ))}
          </nav>
        )}
      </div>
      <article
        className="forecast-body rounded-xl border border-border bg-surface p-6 md:p-8"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
