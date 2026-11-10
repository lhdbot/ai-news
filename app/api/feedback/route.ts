import fs from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { apiError, apiJson } from "@/lib/api";

const STATE_FILE = path.join(process.cwd(), "data", "state", "feedback.json");
const ACTIONS = new Set(["like", "dislike", "save", "clear"]);

interface FeedbackState {
  version: number;
  items: Record<string, { action: string; at: string }>;
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError(400, "invalid_body", "请求体必须是 JSON");
  }
  const id = (body as { id?: unknown })?.id;
  const action = (body as { action?: unknown })?.action;
  if (
    typeof id !== "string" ||
    id.length < 1 ||
    id.length > 200 ||
    typeof action !== "string" ||
    !ACTIONS.has(action)
  ) {
    return apiError(400, "invalid_body", "id 或 action 不合法");
  }

  let state: FeedbackState = { version: 1, items: {} };
  try {
    state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")) as FeedbackState;
  } catch {
    // 首次运行
  }
  if (!state.items) state.items = {};
  if (action === "clear") delete state.items[id];
  else state.items[id] = { action, at: new Date().toISOString() };

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, STATE_FILE);

  try {
    // 让首页 TOP5 在下次请求时用新反馈重新排序
    revalidatePath("/");
  } catch {
    // ignore
  }
  return apiJson({ ok: true, id, action: action === "clear" ? null : action });
}
