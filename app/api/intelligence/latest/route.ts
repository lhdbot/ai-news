import { apiError, apiJson, parseKind } from "@/lib/api";
import { getLatestForecast } from "@/lib/forecasts";
import { getLatestImpact } from "@/lib/impact";

export function GET(request: Request): Response {
  const kind = parseKind(new URL(request.url).searchParams.get("kind"));
  if (!kind) return apiError(400, "invalid_kind", "kind 仅支持 daily 或 weekly");

  const forecast = getLatestForecast(kind);
  const impact = getLatestImpact(kind);
  if (!forecast && !impact) {
    return apiError(404, "not_found", "暂无预测或影响分析数据");
  }
  return apiJson({ kind, forecast, impact });
}
