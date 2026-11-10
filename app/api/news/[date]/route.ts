import { apiError, apiJson, isValidDate, parseNewsView } from "@/lib/api";
import { getDigest } from "@/lib/digest";
import { getNewsByDate } from "@/lib/news";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/news/[date]">,
): Promise<Response> {
  const { date } = await ctx.params;
  if (!isValidDate(date)) {
    return apiError(400, "invalid_date", "日期格式应为 YYYY-MM-DD 且必须是真实日期");
  }
  const view = parseNewsView(new URL(request.url).searchParams.get("view"));
  if (!view) return apiError(400, "invalid_view", "view 仅支持 full 或 digest");

  const news = getNewsByDate(date);
  if (!news) return apiError(404, "not_found", "该日期没有新闻数据");
  if (view === "digest") {
    const digest = getDigest(date);
    if (digest) return apiJson(digest);
  }
  return apiJson(news);
}