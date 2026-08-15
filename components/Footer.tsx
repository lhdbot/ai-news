import { SITE_NAME, SITE_URL } from "@/lib/site";
import { getSources } from "@/lib/sources";

export default function Footer() {
  const sources = getSources();
  return (
    <footer className="mt-16 border-t border-border-soft bg-bg-2">
      <div className="mx-auto max-w-7xl px-4 py-9 md:px-6">
        <div className="src-title">监测信息源 · {sources.length}</div>
        <div className="src-tags">
          {sources.map((s) => (
            <a
              key={s.name}
              className="src-tag"
              href={s.site ?? s.url}
              target="_blank"
              rel="noreferrer"
            >
              {s.name}
            </a>
          ))}
        </div>
        <p className="mt-4 text-xs text-faint">
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
        <div className="mt-7 flex flex-wrap justify-between gap-4 font-mono text-[11px] text-faint">
          <span>
            {SITE_NAME} · AI DAILY INTEL — 每 30 分钟自动聚合全球 AI
            资讯，由本地 Kimi 生成中文摘要与解读
          </span>
          <span>
            内容版权归原作者及来源网站所有 ·{" "}
            <a href="/feed.xml" className="underline hover:text-accent">
              RSS 订阅
            </a>{" "}
            ·{" "}
            <a
              href={SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-accent"
            >
              {SITE_URL}
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
