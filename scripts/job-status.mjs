#!/usr/bin/env node
/**
 * 任务状态记录：bat 首尾调用，写入 data/state/jobs/<job>.json 与 logs/app.jsonl。
 *
 * 用法:
 *   node scripts/job-status.mjs start  watch
 *   node scripts/job-status.mjs finish watch ok
 *   node scripts/job-status.mjs finish watch failed "fetch failed"
 */
import fs from 'node:fs';
import path from 'node:path';
import { logEvent } from './lib/log.mjs';

const ROOT = process.cwd();
const JOBS_DIR = path.join(ROOT, 'data', 'state', 'jobs');
const [, , action, job, ...rest] = process.argv;

if (!action || !job) {
  console.error('usage: job-status start|finish <job> [status] [error]');
  process.exit(0);
}

const file = path.join(JOBS_DIR, `${job}.json`);

function read() {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function write(data) {
  fs.mkdirSync(JOBS_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

try {
  if (action === 'start') {
    const now = new Date().toISOString();
    write({ job, runId: now, pid: process.ppid, startedAt: now, status: 'running' });
    logEvent(ROOT, { job, status: 'start' });
  } else if (action === 'finish') {
    const status = rest[0] || 'ok';
    const error = rest.slice(1).join(' ') || '';
    const prev = read() || {};
    const finishedAt = new Date().toISOString();
    const started = prev.startedAt ? Date.parse(prev.startedAt) : NaN;
    const data = {
      ...prev,
      job,
      startedAt: prev.startedAt || finishedAt,
      finishedAt,
      status,
      error,
      durationMs: Number.isNaN(started) ? null : Date.now() - started,
    };
    write(data);
    logEvent(ROOT, { job, status, error, durationMs: data.durationMs });
  } else {
    console.error(`unknown action: ${action}`);
  }
} catch (err) {
  // 状态记录失败不阻断 bat
  console.error('[job-status]', err.message);
}
