import { SITE_NAME, SITE_URL } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-border/70">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-8 text-sm text-muted">
        <p>
          {SITE_NAME} · 每日自动聚合全球 AI 资讯，由 DeepSeek 生成中文摘要
        </p>
        <p className="text-xs opacity-70">
          内容来自 arXiv、OpenAI、Google DeepMind、Microsoft Research、Hugging
          Face 及中英文科技媒体，版权归原作者所有 ·{" "}
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
    </footer>
  );
}
