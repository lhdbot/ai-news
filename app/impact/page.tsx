import type { Metadata } from "next";
import { marked } from "marked";
import {
  getAllImpacts,
  getImpactByDate,
  getLatestImpact,
  type ImpactKind,
} from "@/lib/impact";
import { formatDateCN } from "@/lib/news";

export const metadata: Metadata = {
  title: "对我的影响",
  description:
    "三日影响分析（每天更新）+ 七天影响分析（每周一更新）：AI 新闻对我的岗位、技能和项目有什么影响，每条结论均标注依据出处。",
};

interface Section {
  kind: ImpactKind;
  title: string;
  cadence: string;
  param: "d" | "w";
}

const SECTIONS: Section[] = [
  {
    kind: "daily",
    title: "三日影响分析",
    cadence: "每天更新 · 汇总近 3 天新闻",
    param: "d",
  },
  {
    kind: "weekly",
    title: "七天影响分析",
    cadence: "每周一 08:00 更新 · 汇总近 7 天新闻",
    param: "w",
  },
];

export default function ImpactPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; w?: string }>;
}) {
  return <ImpactBody searchParams={searchParams} />;
}

async function ImpactBody({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; w?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-bold">对我的影响</h1>
      <p className="mt-2 text-sm text-muted">
        由本地 Kimi 结合新闻与市场行情生成，每条结论末尾的「依据」可点击溯源到原新闻。
      </p>
      <div className="mt-10 space-y-14">
        {SECTIONS.map((section) => (
          <ImpactSection
            key={section.kind}
            section={section}
            selected={params[section.param]}
          />
        ))}
      </div>
    </main>
  );
}

async function ImpactSection({
  section,
  selected,
}: {
  section: Section;
  selected?: string;
}) {
  const all = getAllImpacts(section.kind);
  const impact = selected
    ? getImpactByDate(section.kind, selected)
    : getLatestImpact(section.kind);

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
                href={`/impact?${section.param}=${date}`}
                className={`rounded border px-2 py-1 transition-colors ${
                  date === impact?.date
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
      {!impact ? (
        <p className="text-muted">
          还没有{section.title}，等待计划任务生成第一期。
        </p>
      ) : (
        <article
          className="forecast-body rounded-xl border border-border bg-surface p-6 md:p-8"
          dangerouslySetInnerHTML={{
            __html: await marked.parse(impact.markdown, { async: true }),
          }}
        />
      )}
    </section>
  );
}
