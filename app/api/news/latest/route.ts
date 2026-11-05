import { apiError, apiJson } from "@/lib/api";
import { getLatestNews } from "@/lib/news";

export function GET(): Response {
  const news = getLatestNews();
  if (!news) return apiError(404, "not_found", "暂无新闻数据");
  return apiJson(news);
}
