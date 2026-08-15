#!/usr/bin/env node
/**
 * 把当日报告通过 hermes agent 的管道（hermes send）推送到个人微信。
 *
 * 用法:
 *   node scripts/push-wechat.mjs            # 推当日三日预测 + 三日影响分析（全文）
 *   node scripts/push-wechat.mjs --weekly   # 加推当日七天预测 + 七天影响分析（每周一）
 *   node scripts/push-wechat.mjs --test     # 发一条连通性测试消息
 *
 * 前置条件（一次性）：
 *   1. hermes agent 部署完成，且 `hermes gateway setup` 选 Weixin 扫码登录
 *   2. 微信里给 bot 发过一条消息，~/.hermes/.env 设好 WEIXIN_HOME_CHANNEL=<chat_id>
 *   3. 可选环境变量：AI_NEWS_HERMES（hermes 可执行文件路径）、
 *      AI_NEWS_WECHAT_TARGET（推送目标，默认 weixin，即 home channel）
 *
 * 推送失败不阻断主流程（始终 exit 0），只写日志。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findHermes, sendOnce } from './lib/hermes.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const beijingToday = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);

function readReport(subdir, date) {
  const file = path.join(ROOT, 'data', subdir, `${date}.md`);
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** iLink 有限频：撞到限频时拉长间隔轻拿轻放（120s），普通错误 35s；最多 2 次，不过频打扰被限账户 */
async function send(hermes, body) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { ok, err, stdout, stderr } = await sendOnce(hermes, body);
    if (ok) {
      console.log(`[push] 推送成功 ${String(stdout).trim().slice(0, 200)}`);
      return;
    }
    const detail = `${err.message.slice(0, 200)} ${String(stderr).slice(0, 300)}`;
    if (attempt < 2) {
      const waitS = /rate.?limit|cooldown/i.test(detail) ? 120 : 35;
      console.warn(`[push] 第 ${attempt} 次推送失败，${waitS}s 后重试: ${detail}`);
      await sleep(waitS * 1000);
    } else {
      console.warn(`[push] 推送失败（不阻断主流程）: ${detail}`);
    }
  }
}

async function main() {
  const hermes = findHermes();

  if (process.argv.includes('--test')) {
    console.log(`[push] 用 ${hermes} 向 ${TARGET} 发测试消息…`);
    await send(hermes, `【AI 日报】推送链路测试 ${new Date().toISOString()} —— 看到这条说明 hermes → 微信已打通`);
    return;
  }

  const weekly = process.argv.includes('--weekly');
  const date = beijingToday();
  const parts = [];
  const push = (subdir, label) => {
    const md = readReport(subdir, date);
    if (md) parts.push(md.trim());
    else console.warn(`[push] 今日 ${label} 不存在（data/${subdir}/${date}.md），跳过该部分`);
  };
  push('forecasts/daily', '三日预测');
  push('impact/daily', '三日影响分析');
  if (weekly) {
    push('forecasts/weekly', '七天预测');
    push('impact/weekly', '七天影响分析');
  }

  if (parts.length === 0) {
    console.log(`[push] 今日（${date}）没有可推送的报告，跳过`);
    return;
  }

  const body = `【AI 日报】${date}${weekly ? '（含周报）' : ''}\n\n` + parts.join('\n\n---\n\n');
  console.log(`[push] 用 ${hermes} 推送 ${body.length} 字符到 ${TARGET}…`);
  await send(hermes, body);
}

main().catch((e) => {
  console.warn(`[push] 异常（不阻断主流程）: ${e.message.slice(0, 200)}`);
});
