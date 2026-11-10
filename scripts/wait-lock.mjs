#!/usr/bin/env node
/**
 * 跨任务互斥锁：所有计划任务（bat）共用 logs/job.lock，避免并行撞车。
 *
 * 用法（在 bat 中，拿到锁返回 0，拿不到返回 1）：
 *   node scripts/wait-lock.mjs --name watch --mode skip
 *   node scripts/wait-lock.mjs --name daily --mode wait
 *
 * 自愈规则（2026-11-10 起）：
 * - 锁内容为 JSON：{ job, pid, startedAt }，pid 是持有 bat 的父进程；
 * - 超过 45 分钟，或持有进程已退出 → 判定为陈旧并清理；
 * - wait 模式最长排队 45 分钟；拿到锁的任务在 bat 末尾删除 logs\job.lock。
 */
import path from 'node:path';
import {
  isProcessAlive,
  lockIsStale,
  readLock,
  releaseLock,
  tryAcquireLock,
} from './lib/lock.mjs';

const args = process.argv.slice(2);
const argVal = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const NAME = argVal('--name', 'job');
const MODE = argVal('--mode', 'wait');

const LOCK = path.join(process.cwd(), 'logs', 'job.lock');
const MAX_WAIT_MS = 45 * 60e3;
const SETTLE_MS = 150e3;
const POLL_MS = 30e3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const tag = (msg) => console.log(`[提示][${NAME}] ${msg}`);

function clearStale() {
  const lock = readLock(LOCK);
  if (!lock) return false;
  if (!lockIsStale(lock)) return false;
  const reason = lock.pid && !isProcessAlive(lock.pid)
    ? `持有进程 ${lock.pid} 已退出`
    : `超过 45 分钟未释放`;
  releaseLock(LOCK);
  tag(`检测到异常遗留的任务锁（${lock.job || 'unknown'}，${reason}），已自动清理`);
  return true;
}

function acquire() {
  const lock = tryAcquireLock(LOCK, NAME);
  if (lock) return true;
  return false;
}

async function main() {
  clearStale();
  if (acquire()) process.exit(0);

  if (MODE === 'skip') {
    tag('另一个任务正在运行，本次跳过');
    process.exit(1);
  }

  tag('检测到另一个任务正在运行，进入串行排队');
  const t0 = Date.now();
  for (;;) {
    await sleep(POLL_MS);
    clearStale();
    if (!readLock(LOCK)) {
      tag('前一个任务已完成，等待串行间隔后开始本任务…');
      await sleep(SETTLE_MS);
      clearStale();
      if (acquire()) {
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
