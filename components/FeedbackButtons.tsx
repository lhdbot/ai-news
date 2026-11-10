"use client";

import { useEffect, useState } from "react";

type Action = "save" | "like" | "dislike";

const OPTIONS: { action: Action; label: string; activeLabel: string }[] = [
  { action: "save", label: "收藏", activeLabel: "已收藏" },
  { action: "like", label: "有用", activeLabel: "已有用" },
  { action: "dislike", label: "不感兴趣", activeLabel: "已标记" },
];

/** 本地反馈：写入 data/state/feedback.json，并参与首页相关度排序 */
export default function FeedbackButtons({ id }: { id: string }) {
  const [action, setAction] = useState<Action | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai-news:feedback");
      const map = raw ? JSON.parse(raw) : {};
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 从 localStorage 恢复本地反馈状态
      setAction(map[id] ?? null);
    } catch {
      // ignore
    }
  }, [id]);

  async function toggle(next: Action) {
    if (pending) return;
    const value = action === next ? "clear" : next;
    setPending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, action: value }),
      });
      if (!res.ok) throw new Error("failed");
      setAction(value === "clear" ? null : next);
      try {
        const raw = localStorage.getItem("ai-news:feedback");
        const map = raw ? JSON.parse(raw) : {};
        if (value === "clear") delete map[id];
        else map[id] = next;
        localStorage.setItem("ai-news:feedback", JSON.stringify(map));
      } catch {
        // ignore
      }
    } catch {
      // 失败时保持原状态，下次可重试
    }
    setPending(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]" aria-label="对这条内容反馈">
      {OPTIONS.map((option) => {
        const active = action === option.action;
        return (
          <button
            key={option.action}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => toggle(option.action)}
            className={`rounded border px-1.5 py-0.5 transition-colors disabled:opacity-50 ${
              active
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted hover:border-accent/60 hover:text-fg"
            }`}
          >
            {active ? option.activeLabel : option.label}
          </button>
        );
      })}
    </div>
  );
}
