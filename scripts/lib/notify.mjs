/**
 * 告警通知封装：notify(text) 通过 `hermes send --to weixin` 发消息（实现在 lib/hermes.mjs）。
 * 失败只 console.warn，绝不抛错，不阻断主流程。
 */
import { findHermes, sendOnce } from "./hermes.mjs";

export async function notify(text) {
  const hermes = findHermes();
  const { ok, err, stdout, stderr } = await sendOnce(hermes, text);
  if (ok) {
    console.log(`[notify] 推送成功 ${String(stdout).trim().slice(0, 200)}`);
  } else {
    console.warn(
      `[notify] 推送失败（不阻断主流程）: ${err.message.slice(0, 200)} ${String(stderr).slice(0, 300)}`,
    );
  }
}
