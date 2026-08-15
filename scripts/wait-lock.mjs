#!/usr/bin/env node
/**
 * 跨任务互斥锁：所有计划任务（bat）共用 logs/job.lock，避免并行撞车。
 *
 * 用法（在 bat 中，拿到锁返回 0，拿不到返回 1）：
 *   node scripts/wait-lock.mjs --name watch --mode skip   # 锁被占就直接跳过（watch 用，半小时后还会再跑）
 *   node scripts/wait-lock.mjs --name daily --mode wait   # 串行排队：等对方完成，再等 2.5 分钟拿锁
 *
 * 规则：
 * - 锁超过 2 小时视为上次任务异常死亡，自动清理（自愈），日志写 [提示]
 * - wait 模式最长排队 45 分钟，超时放弃并写 [提示]
 * - 拿到锁的任务在 bat 末尾必须 del logs\job.lock
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const argVal = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const NAME = argVal('--name', 'job');
const MODE = argVal('--mode', 'wait');

const LOCK = path.join(process.cwd(), 'logs', 'job.lock');
const STALE_MS = 2 * 3600e3;      // 2 小时自愈
const MAX_WAIT_MS = 45 * 60e3;    // 最长排队 45 分钟
const SETTLE_MS = 150e3;          // 前一个任务完成后的串行间隔（2.5 分钟）
const POLL_MS = 30e3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (msg) => console.log(`[提示][${NAME}] ${msg}`);

function lockAge() {
  try {
    return Date.now() - fs.statSync(LOCK).mtimeMs;
  } catch {
    return -1; // 不存在
  }
}

function tryAcquire() {
  try {
    fs.writeFileSync(LOCK, `${NAME} ${new Date().toISOString()}\n`, { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

function clearStale() {
  const age = lockAge();
  if (age > STALE_MS) {
    fs.rmSync(LOCK, { force: true });
    tag(`检测到异常遗留的任务锁（约 ${Math.round(age / 60000)} 分钟前），已自动清理`);
    return true;
  }
  return false;
}

async function main() {
  clearStale();
  if (tryAcquire()) process.exit(0);

  if (MODE === 'skip') {
    tag('另一个任务正在运行，本次跳过');
    process.exit(1);
  }

  tag('检测到另一个任务正在运行，进入串行排队（对方完成后等 2-3 分钟再执行本任务）');
  const t0 = Date.now();
  for (;;) {
    await sleep(POLL_MS);
    clearStale();
    if (lockAge() === -1) {
      // 锁刚释放：先等串行间隔再拿锁
      tag('前一个任务已完成，等待 2-3 分钟后开始本任务...');
      await sleep(SETTLE_MS);
      clearStale();
      if (tryAcquire()) {
        tag('已轮到本任务，开始执行');
        process.exit(0);
      }
      tag('锁被其他任务抢先拿走，继续排队');
    }
    if (Date.now() - t0 > MAX_WAIT_MS) {
      tag('排队超过 45 分钟，放弃本次执行');
      process.exit(1);
    }
  }
}

main();
