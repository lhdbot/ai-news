import type { Metadata } from "next";
import { marked } from "marked";
import {
  getAllForecasts,
  getAllReviews,
  getForecastByDate,
  getLatestForecast,
  getReviewByDate,
  type ForecastKind,
} from "@/lib/forecasts";
import { formatDateCN } from "@/lib/news";

export const metadata: Metadata = {
  title: "AI 预测",
  description:
    "三日滚动预测（每天 10:00 更新）+ 每周预测（每周一 08:00 更新）：基于近日新闻盘点的 AI 发展方向预测，结合个人情况的行动建议。",
};

interface Section {
  kind: ForecastKind;
  title: string;
  cadence: string;
  param: "d" | "w";
}

const SECTIONS: Section[] = [
  {
    kind: "daily",
    title: "三日滚动预测",
    cadence: "每天 10:00 更新 · 汇总近 3 天新闻",
    param: "d",
  },
  {
    kind: "weekly",
    title: "每周预测",
    cadence: "每周一 08:00 更新 · 汇总近 7 天新闻",
    param: "w",
  },
];

export default function ForecastPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; w?: string; r?: string }>;
}) {
  return <ForecastBody searchParams={searchParams} />;
}

async function ForecastBody({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; w?: string; r?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">AI 预测</h1>
      <p className="mt-2 text-sm text-muted">
        由本地 Kimi 生成：三日滚动预测追踪近期热点，每周预测纵览一周主线。
      </p>
      <div className="mt-10 space-y-14">
        {SECTIONS.map((section) => (
          <ForecastSection
            key={section.kind}
            section={section}
            selected={params[section.param]}
          />
        ))}
        <ReviewSection selected={params.r} />
      </div>
    </main>
  );
}

/** 历史预测应验度：与每周预测同名对应；目录不存在时不渲染该区块 */
async function ReviewSection({ selected }: { selected?: string }) {
  const all = getAllReviews();
  if (all.length === 0) return null;
  const review = selected
    ? getReviewByDate(selected)
    : getReviewByDate(all[0].date);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">历史预测应验度</h2>
        <span className="text-xs text-muted">
          与每周预测同名对应 · 事后校验
        </span>
        {all.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-xs">
            {all.map(({ date }) => (
              <a
                key={date}
                href={`/forecast?r=${date}`}
                className={`rounded border px-2 py-1 transition-colors ${
                  date === review?.date
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
      {!review ? (
        <p className="text-muted">所选日期没有应验度报告。</p>
      ) : (
        <article
          className="forecast-body rounded-xl border border-border bg-surface p-6 md:p-8"
          dangerouslySetInnerHTML={{
            __html: await marked.parse(review.markdown, { async: true }),
          }}
        />
      )}
    </section>
  );
}

async function ForecastSection({
  section,
  selected,
}: {
  section: Section;
  selected?: string;
}) {
  const all = getAllForecasts(section.kind);
  const forecast = selected
    ? getForecastByDate(section.kind, selected)
    : getLatestForecast(section.kind);

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold">{section.title}</h2>
        <span className="text-xs text-muted">{section.cadence}</span>
        {all.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-xs">
            {all.map(({ date }) => (
              <a
                key={date}
                href={`/forecast?${section.param}=${date}`}
                className={`rounded border px-2 py-1 transition-colors ${
                  date === forecast?.date
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
      {!forecast ? (
        <p className="text-muted">
          还没有{section.title}，等待计划任务生成第一期。
        </p>
      ) : (
        <article
          className="forecast-body rounded-xl border border-border bg-surface p-6 md:p-8"
          dangerouslySetInnerHTML={{
            __html: await marked.parse(forecast.markdown, { async: true }),
          }}
        />
      )}
    </section>
  );
}
