/**
 * 任务互斥锁（logs/job.lock）。
 * 锁内容为 JSON：{ job, pid, startedAt }；pid 记录"持有 bat 的父进程"，而不是本脚本。
 * 判定陈旧：超过 45 分钟，或持有进程已不存在。用于任务被 Ctrl+C / 计划任务终止后的自愈。
 */
import fs from 'node:fs';
import path from 'node:path';

export const LOCK_STALE_MS = 45 * 60 * 1000;

export function readLock(file) {
  try {
    const raw = fs.readFileSync(file, 'utf8').trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // 兼容旧格式：`watch 2026-11-10T04:37:02.174Z`
      const [job, startedAt] = raw.split(/\s+/);
      return { job: job || 'unknown', startedAt: startedAt || null, legacy: true, mtimeMs: fs.statSync(file).mtimeMs };
    }
  } catch {
    return null;
  }
}

export function isProcessAlive(pid) {
  if (!pid || !Number.isInteger(Number(pid))) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch (err) {
    // EPERM 表示进程存在但无权发信号
    return err && err.code === 'EPERM';
  }
}

export function lockIsStale(lock, now = Date.now(), staleMs = LOCK_STALE_MS) {
  if (!lock) return true;
  const started = lock.startedAt ? Date.parse(lock.startedAt) : NaN;
  const age = Number.isNaN(started)
    ? (lock.mtimeMs ? now - lock.mtimeMs : Infinity)
    : now - started;
  if (age > staleMs) return true;
  if (lock.pid && !isProcessAlive(lock.pid)) return true;
  return false;
}

/** 以 `wx` 原子创建；失败返回 null（锁已被占用） */
export function tryAcquireLock(file, job, pid = process.ppid) {
  const lock = { job, pid, startedAt: new Date().toISOString() };
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(lock) + '\n', { flag: 'wx' });
    return lock;
  } catch {
    return null;
  }
}

export function releaseLock(file) {
  try { fs.rmSync(file, { force: true }); } catch { /* ignore */ }
}
