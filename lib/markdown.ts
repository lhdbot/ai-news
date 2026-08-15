import { marked } from "marked";

// 预测 / 影响报告的 markdown 由 LLM 生成，可能夹带原始 HTML 或危险链接：
// 1) 渲染前剥离所有 <...> 标签（marked 默认会原样透传原始 HTML，含 <script> 等）
// 2) 链接 / 图片 href 只放行 http(s)/mailto，其余一律置为 "#"
marked.use({
  walkTokens(token) {
    if (token.type === "link" || token.type === "image") {
      if (
        typeof token.href === "string" &&
        !/^(https?:|mailto:)/i.test(token.href)
      ) {
        token.href = "#";
      }
    }
  },
});

/** 安全渲染 LLM 生成的 markdown（防 XSS） */
export async function renderMarkdown(md: string): Promise<string> {
  const safe = (md ?? "").replace(/<[^>]*>/g, "");
  return marked.parse(safe, { async: true });
}
