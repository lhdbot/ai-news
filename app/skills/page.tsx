import type { Metadata } from "next";
import skills from "@/data/skills.json";

export const metadata: Metadata = {
  title: "Skills 推荐",
  description:
    "值得安装的 agent skills（SKILL.md 扩展）：官方合集、社区精选与一人公司场景适配。",
};

interface Skill {
  name: string;
  url: string;
  desc: string;
  why: string;
  group: string;
}

const GROUPS = ["官方", "社区精选", "场景适配"] as const;

export default function SkillsPage() {
  const items = skills as Skill[];
  const byGroup = new Map<string, Skill[]>();
  for (const skill of items) {
    const list = byGroup.get(skill.group) ?? [];
    list.push(skill);
    byGroup.set(skill.group, list);
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl font-extrabold tracking-tight">Skills 推荐</h1>
      <p className="mt-2 text-muted">
        给 Kimi Code / Claude Code 装上的能力扩展（SKILL.md），共 {items.length} 个推荐。
      </p>

      <p className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-2.5 text-sm text-amber-200/90">
        安全提示：第三方 skill 有供应链风险，安装前先过目 SKILL.md。
      </p>

      {GROUPS.map((group) => {
        const list = byGroup.get(group) ?? [];
        if (list.length === 0) return null;
        return (
          <section key={group} className="mt-10">
            <div className="mb-4 flex items-baseline gap-3">
              <h2 className="text-lg font-bold">
                <span className="mr-2 text-accent">#</span>
                {group}
              </h2>
              <span className="text-sm text-muted">{list.length} 个</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {list.map((skill) => (
                <a
                  key={skill.name}
                  href={skill.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/60"
                >
                  <p className="font-mono text-sm font-bold leading-snug transition-colors group-hover:text-accent">
                    {skill.name}
                    <span className="ml-1 inline-block text-muted opacity-0 transition-opacity group-hover:opacity-100">
                      ↗
                    </span>
                  </p>
                  <p className="mt-2 text-[13px] text-muted leading-relaxed">
                    {skill.desc}
                  </p>
                  <div className="mt-3 rounded-md border-l-2 border-accent bg-accent/5 px-2.5 py-1.5">
                    <p className="text-[11px] font-semibold text-accent">
                      为什么值得装
                    </p>
                    <p className="mt-0.5 text-xs text-fg/80 leading-normal">
                      {skill.why}
                    </p>
                  </div>
                  <p className="mt-auto pt-3 text-xs text-muted/70">
                    {skill.url.replace(/^https:\/\//, "")} ↗
                  </p>
                </a>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
