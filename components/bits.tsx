import { starsOf } from "@/lib/relevance";

/** 相关度星级：实心金 ★ + 描边 ★（.off） */
export function Stars({ score }: { score: number }) {
  const n = starsOf(score);
  return (
    <span className="stars" title={`相关度 ${score} 分`}>
      {"★".repeat(n)}
      <span className="off">{"★".repeat(5 - n)}</span>
    </span>
  );
}

/** 发布时间（Asia/Shanghai，HH:mm）；无效时间返回空串 */
export function formatHM(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour: "2-digit",
    minute: "2-digit",
  });
}
