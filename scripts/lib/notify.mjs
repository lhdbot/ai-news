/**
 * hermes 微信推送公共封装：notify(text) 通过 `hermes send --to weixin` 发消息。
 * exe 定位逻辑参照 push-wechat.mjs（环境变量 > 硬编码候选路径 > PATH）。
 * 失败只 console.warn，绝不抛错，不阻断主流程。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';

const TIMEOUT_MS = 5 * 60e3;

const HERMES_CANDIDATES = [
  process.env.AI_NEWS_HERMES,
  'E:/ai_project_myself/hermes-agent/.venv/Scripts/hermes.exe',
  'E:/ai_project_myself/hermes-agent/venv/Scripts/hermes.exe',
  'E:/hermes/hermes-agent/venv/Scripts/hermes.exe',
  'E:/hermes/hermes-agent/venv/Scripts/hermes',
].filter(Boolean);

function findHermes() {
  for (const p of HERMES_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return 'hermes'; // 兜底指望 PATH
}

const TARGET = process.env.AI_NEWS_WECHAT_TARGET || 'weixin';

/**
 * 推送一条文本到微信。失败只告警不抛错。
 * @param {string} text
 */
export async function notify(text) {
  const hermes = findHermes();
  try {
    await new Promise((resolve) => {
      const child = execFile(
        hermes,
        ['send', '--to', TARGET, '--file', '-'],
        { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            console.warn(`[notify] 推送失败（不阻断主流程）: ${err.message.slice(0, 200)} ${String(stderr).slice(0, 300)}`);
          } else {
            console.log(`[notify] 推送成功 ${String(stdout).trim().slice(0, 200)}`);
          }
          resolve();
        },
      );
      child.stdin.write(text);
      child.stdin.end();
    });
  } catch (e) {
    console.warn(`[notify] 异常（不阻断主流程）: ${e.message.slice(0, 200)}`);
  }
}
