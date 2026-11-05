import { apiError, apiJson, isValidDate } from "@/lib/api";
import { getNewsByDate } from "@/lib/news";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/news/[date]">,
): Promise<Response> {
  const { date } = await ctx.params;
  if (!isValidDate(date)) {
    return apiError(400, "invalid_date", "日期格式应为 YYYY-MM-DD 且必须是真实日期");
  }

  const news = getNewsByDate(date);
  if (!news) return apiError(404, "not_found", "该日期没有新闻数据");
  return apiJson(news);
}
