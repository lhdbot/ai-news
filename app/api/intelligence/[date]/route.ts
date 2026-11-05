import { apiError, apiJson, isValidDate, parseKind } from "@/lib/api";
import { getForecastByDate } from "@/lib/forecasts";
import { getImpactByDate } from "@/lib/impact";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/intelligence/[date]">,
): Promise<Response> {
  const { date } = await ctx.params;
  if (!isValidDate(date)) {
    return apiError(400, "invalid_date", "日期格式应为 YYYY-MM-DD 且必须是真实日期");
  }

  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  if (!kind) return apiError(400, "invalid_kind", "kind 仅支持 daily 或 weekly");

  const forecast = getForecastByDate(kind, date);
  const impact = getImpactByDate(kind, date);
  if (!forecast && !impact) {
    return apiError(404, "not_found", "该日期没有预测或影响分析数据");
  }
  return apiJson({ kind, forecast, impact });
}
