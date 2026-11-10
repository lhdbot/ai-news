import { apiError, apiJson, parseNewsView } from "@/lib/api";
import { getDigest } from "@/lib/digest";
import { getLatestNews } from "@/lib/news";

export function GET(request: Request): Response {
  const view = parseNewsView(new URL(request.url).searchParams.get("view"));
  if (!view) return apiError(400, "invalid_view", "view 仅支持 full 或 digest");

  const news = getLatestNews();
  if (!news) return apiError(404, "not_found", "暂无新闻数据");
  if (view === "digest") {
    const digest = getDigest(news.date);
    if (digest) return apiJson(digest);
    // digest 尚未生成时回退全量，避免本地工具取不到数据
  }
  return apiJson(news);
}