"use client";

import { useMemo, useState } from "react";

export interface SearchItem {
  date: string;
  title: string;
  title_zh: string;
  summary_zh: string;
  tags: string[];
  url: string;
  source: string;
}

const MAX_RESULTS = 50;

export default function SearchClient({ items }: { items: SearchItem[] }) {
  const [query, setQuery] = useState("");

  const { results, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { results: [] as SearchItem[], total: 0 };
    const matched = items.filter((item) =>
      [item.title, item.title_zh, item.summary_zh, ...item.tags]
        .join("\n")
        .toLowerCase()
        .includes(q),
    );
    return { results: matched.slice(0, MAX_RESULTS), total: matched.length };
  }, [items, query]);

  return (
    <div className="mt-6">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="输入关键词，如：Agent、RAG、vLLM…"
        autoFocus
        className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent/60"
      />

      {query.trim() && (
        <p className="mt-3 text-xs text-muted">
          命中 {total} 条
          {total > MAX_RESULTS ? `，显示前 ${MAX_RESULTS} 条` : ""}
        </p>
      )}

      <ul className="mt-4 space-y-3">
        {results.map((item) => (
          <li
            key={`${item.date}-${item.url}`}
            className="rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60"
          >
            <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{item.date}</span>
              <span className="font-medium text-fg/70">{item.source}</span>
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-bold leading-snug transition-colors hover:text-accent"
            >
              {item.title_zh || item.title}
            </a>
            {item.summary_zh && (
              <p className="mt-1.5 text-xs leading-normal text-muted line-clamp-2">
                {item.summary_zh}
              </p>
            )}
            {item.tags.length > 0 && (
              <p className="mt-1.5 text-[11px] text-muted/70">
                {item.tags.join(" · ")}
              </p>
            )}
          </li>
        ))}
      </ul>

      {query.trim() && results.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">
          没有匹配的条目，换个关键词试试。
        </p>
      )}
    </div>
  );
}
