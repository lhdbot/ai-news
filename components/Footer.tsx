import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getSources } from "@/lib/sources";

export default function Footer() {
  const sources = getSources();
  return (
    <footer className="mt-16 border-t border-border/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 text-sm text-muted md:flex-row md:justify-between">
        {/* 左下角：信息来源 */}
        <div className="max-w-xl">
          <p className="mb-2 text-xs font-semibold tracking-wider text-muted">
            信息来源（{sources.length}）
          </p>
          <ul className="flex flex-wrap gap-x-1 gap-y-1.5 text-xs">
            {sources.map((s, i) => (
              <li key={s.name} className="flex items-center">
                <a
                  href={s.site ?? s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-md border border-border/60 px-2 py-1 transition-colors hover:border-accent/50 hover:text-accent"
                >
                  {s.name}
                </a>
                {i < sources.length - 1 && <span className="sr-only">、</span>}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs opacity-70">
            想加源？编辑{" "}
            <a
              href="https://github.com/lhdbot/ai-news/blob/main/data/sources.json"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-accent"
            >
              data/sources.json
            </a>{" "}
            加一项，30 分钟内巡检自动生效
          </p>
        </div>

        {/* 右下：站点说明 */}
        <div className="flex shrink-0 flex-col gap-2 md:text-right">
          <p>
            {SITE_NAME} · 每 30 分钟自动聚合全球 AI 资讯，由本地 Kimi
            生成中文摘要与解读
          </p>
          <p className="text-xs opacity-70">
            内容版权归原作者及来源网站所有 ·{" "}
            <a href="/feed.xml" className="underline hover:text-accent">
              RSS 订阅
            </a>{" "}
            ·{" "}
            <a
              href={SITE_URL}
              className="underline hover:text-accent"
              target="_blank"
              rel="noreferrer"
            >
              {SITE_URL}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
