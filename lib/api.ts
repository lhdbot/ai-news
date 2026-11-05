export type IntelligenceKind = "daily" | "weekly";

export function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function parseKind(value: string | null): IntelligenceKind | null {
  if (value === null || value === "daily") return "daily";
  if (value === "weekly") return "weekly";
  return null;
}

export function apiJson(data: unknown): Response {
  return Response.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

export function apiError(
  status: number,
  code: "invalid_date" | "invalid_kind" | "not_found",
  message: string,
): Response {
  return Response.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
