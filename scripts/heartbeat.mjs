#!/usr/bin/env node
/**
 * 心跳检查：判断 ai-news 日报是否断更。
 *
 * 读取 data/state/last-success.json（由 fetch-news.mjs 成功结束时写入），
 * 距上次成功抓取超过 26 小时（或文件缺失/损坏）则：
 *   - 打印告警日志
 *   - 动态 import('./lib/notify.mjs') 调 notify(text) 发送告警
 *     （该文件可能尚不存在，容忍缺失，仅记录日志）
 *   - 以退出码 1 结束
 * 否则静默 exit 0。
 *
 * 用法：node scripts/heartbeat.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LAST_SUCCESS_FILE = path.join(
  __dirname,
  "..",
  "data",
  "state",
  "last-success.json",
);
const MAX_STALE_MS = 26 * 3600 * 1000;
const ALERT_TEXT = "ai-news 日报可能断更：已超过 26h 未成功抓取";

async function tryNotify(text) {
  try {
    const mod = await import("./lib/notify.mjs");
    if (typeof mod.notify === "function") {
      await mod.notify(text);
      console.log("[ok] 告警已通过 lib/notify.mjs 发送");
    }
  } catch (err) {
    console.warn(`[warn] notify 模块不可用，告警仅记录日志: ${err.message}`);
  }
}

async function main() {
  let ts = null;
  try {
    ts = JSON.parse(fs.readFileSync(LAST_SUCCESS_FILE, "utf-8")).ts;
  } catch {
    /* 文件缺失或损坏视为断更 */
  }
  const age = ts ? Date.now() - new Date(ts).getTime() : Infinity;
  if (!ts || Number.isNaN(age) || age > MAX_STALE_MS) {
    console.error(`[alert] ${ALERT_TEXT}`);
    await tryNotify(ALERT_TEXT);
    process.exit(1);
  }
  // 未超时：静默退出
  process.exit(0);
}

main();
