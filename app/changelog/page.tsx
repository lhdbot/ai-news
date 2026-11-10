import type { Metadata } from "next";
import changelog from "@/data/changelog.json";

export const metadata: Metadata = {
  title: "更新日志",
  description: "ai-news 的版本、功能与修复记录。",
};

interface Change {
  type: string;
  text: string;
}

interface Entry {
  version: string;
  date: string;
  title: string;
  summary: string;
  tags: string[];
  changes: Change[];
}

const TYPE_STYLE: Record<string, string> = {
  新增: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
  修复: "border-amber-400/40 bg-amber-400/10 text-amber-300",
  优化: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  安全: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-300",
  移除: "border-border bg-surface-2 text-muted",
};

function Tag({ text }: { text: string }) {
  const style = TYPE_STYLE[text] ?? "border-border bg-surface-2 text-muted";
  return (
    <span className={"rounded border px-1.5 py-0.5 text-[11px] font-medium " + style}>
      {text}
    </span>
  );
}

export default function ChangelogPage() {
  const { current, entries } = changelog as { current: string; entries: Entry[] };

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">更新日志</h1>
          <p className="mt-2 text-muted">版本、功能与修复记录；最新在上。</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-sm text-accent">
          当前版本 v{current}
        </span>
      </div>

      <div className="mt-10 space-y-10 border-l border-border pl-6">
        {entries.map((entry, index) => (
          <section key={entry.version} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[31px] top-2 h-3 w-3 rounded-full bg-accent ring-4 ring-bg"
            />

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 font-mono text-sm text-accent">
                v{entry.version}
              </span>
              {index === 0 && (
                <span className="rounded border border-gold/40 bg-gold/10 px-2 py-0.5 text-[11px] font-medium text-gold">
                  最新
                </span>
              )}
              <time className="font-mono text-xs text-muted" dateTime={entry.date}>
                {entry.date}
              </time>
              {entry.tags.map((tag) => (
                <span key={tag} className="rounded border border-border bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                  {tag}
                </span>
              ))}
            </div>

            <h2 className="mt-2 text-xl font-bold">{entry.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{entry.summary}</p>

            <ul className="mt-4 space-y-2">
              {entry.changes.map((change) => (
                <li key={change.type + change.text} className="flex items-start gap-2 text-sm leading-relaxed">
                  <Tag text={change.type} />
                  <span className="text-fg/85">{change.text}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
