import type { Metadata } from "next";
import { marked } from "marked";
import { getAllImpacts, getImpactByDate, getLatestImpact } from "@/lib/impact";
import { formatDateCN } from "@/lib/news";

export const metadata: Metadata = {
  title: "对我的影响",
  description: "每日市场行情分析：今天的 AI 新闻对我的岗位、技能和项目有什么影响。",
};

export default function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  return <ImpactBody searchParams={searchParams} />;
}

async function ImpactBody({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const all = getAllImpacts();
  const impact = d ? getImpactByDate(d) : getLatestImpact();

  if (!impact) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center text-muted">
        <h1 className="text-2xl font-bold text-fg">对我的影响</h1>
        <p className="mt-4">
          还没有影响分析。运行 <code>node scripts/daily-impact.mjs</code> 生成第一期。
        </p>
      </main>
    );
  }

  const html = await marked.parse(impact.markdown, { async: true });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">对我的影响</h1>
        <span className="text-xs text-muted">
          每天一份 · 由本地 Kimi 结合当日新闻与市场行情生成
        </span>
        {all.length > 1 && (
          <nav className="flex flex-wrap gap-2 text-xs">
            {all.map(({ date }) => (
              <a
                key={date}
                href={`/impact?d=${date}`}
                className={`rounded border px-2 py-1 transition-colors ${
                  date === impact.date
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
