/**
 * hermes agent（微信推送通道）公共封装：exe 定位 + 单次发送。
 * push-wechat.mjs（带重试/限频退避）与 lib/notify.mjs（告警）共用，
 * 避免各处重复实现候选路径探测与子进程调用。
 */
import { execFile } from "node:child_process";
import fs from "node:fs";

const TIMEOUT_MS = 5 * 60e3;

const HERMES_CANDIDATES = [
  process.env.AI_NEWS_HERMES,
  "E:/ai_project_myself/hermes-agent/.venv/Scripts/hermes.exe",
  "E:/ai_project_myself/hermes-agent/venv/Scripts/hermes.exe",
  "E:/hermes/hermes-agent/venv/Scripts/hermes.exe",
  "E:/hermes/hermes-agent/venv/Scripts/hermes",
].filter(Boolean);

/** 定位 hermes 可执行文件：环境变量 > 历史候选路径 > PATH */
export function findHermes() {
  for (const p of HERMES_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return "hermes"; // 兜底指望 PATH
}

export const WECHAT_TARGET = process.env.AI_NEWS_WECHAT_TARGET || "weixin";

/** 单次推送（--file - 从 stdin 读正文）；永不 reject，返回 { ok, err, stdout, stderr } */
export function sendOnce(hermes, body) {
  return new Promise((resolve) => {
    const child = execFile(
      hermes,
      ["send", "--to", WECHAT_TARGET, "--file", "-"],
      { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout, stderr) => {
        resolve({ ok: !err, err, stdout, stderr });
      },
    );
    child.stdin.write(body);
    child.stdin.end();
  });
}
