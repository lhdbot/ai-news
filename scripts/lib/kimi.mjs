/**
 * 本机 Kimi CLI（kimi -p）公共调用封装。
 * summarize-local / daily-impact / weekly-forecast / forecast-review 共用，
 * 避免各处重复实现 exe 定位、重试与输出截尾逻辑。
 */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

/** 定位 kimi 可执行文件：优先 ~/.kimi-code/bin/kimi.exe（原生 exe，避免 cmd 中文/转义问题），兜底 PATH */
export function findKimi() {
  const local = path.join(os.homedir(), '.kimi-code', 'bin', 'kimi.exe');
  return fs.existsSync(local) ? local : 'kimi';
}

/**
 * 以非交互模式调用 Kimi CLI，失败重试，最终失败抛错。
 * @param {string} prompt
 * @param {{retries?: number, timeoutMs?: number, label?: string}} opts
 * @returns {Promise<string>} stdout 原文（含可能的会话尾巴，需自行截取）
 */
export async function callKimi(prompt, { retries = 2, timeoutMs = 15 * 60 * 1000, label = 'kimi' } = {}) {
  const KIMI = findKimi();
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { stdout } = await run(KIMI, ['-p', prompt], {
        maxBuffer: 64 * 1024 * 1024,
        timeout: timeoutMs,
      });
      return stdout;
    } catch (e) {
      lastErr = e;
      console.warn(`[${label}] attempt ${attempt} failed: ${e.message.slice(0, 200)}`);
    }
  }
  throw lastErr;
}

/**
 * 从 kimi 输出中提取 markdown 正文：截到第一个 '#'，去掉会话尾巴，
 * 并去除正文公共前导缩进（kimi 有时整体缩进，导致标题/列表不渲染）。
 */
export function extractMarkdown(text) {
  const start = text.indexOf('#');
  if (start === -1) throw new Error('no markdown in kimi output');
  let md = text.slice(start);
  const tail = md.indexOf('To resume this session');
  if (tail !== -1) md = md.slice(0, tail);
  // 首行因 slice 从 '#' 开始已无缩进，计算公共缩进时跳过首行
  const lines = md.trim().split('\n');
  const indents = lines.slice(1).filter(l => l.trim()).map(l => l.match(/^ */)[0].length);
  const min = indents.length ? Math.min(...indents) : 0;
  if (min > 0) md = lines.map((l, i) => (i === 0 ? l : l.slice(Math.min(min, l.match(/^ */)[0].length)))).join('\n');
  return md.trim() + '\n';
}

/**
 * 从 kimi 输出中提取 JSON 数组（取第一个 '[' 到最后一个 ']'）。
 */
export function extractJson(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) throw new Error('no JSON array in output');
  return JSON.parse(text.slice(start, end + 1));
}
