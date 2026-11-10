/**
 * 结构化运行日志（JSON Lines）：logs/app.jsonl。
 * 保留原有 update.log，新增的 job 状态/失败信息同时写一份可机读日志。
 */
import fs from 'node:fs';
import path from 'node:path';

export function logEvent(root, event) {
  try {
    const line = JSON.stringify({ time: new Date().toISOString(), ...event }) + '\n';
    fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
    fs.appendFileSync(path.join(root, 'logs', 'app.jsonl'), line, 'utf8');
  } catch {
    // 日志失败不影响主流程
  }
}
