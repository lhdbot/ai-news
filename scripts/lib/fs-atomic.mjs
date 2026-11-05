/**
 * 原子写文件：先写同目录临时文件再 rename，避免运行中的 Next 服务读到半截 JSON
 * （历史上出现过 ZodError: items[n].category Invalid option）。
 */
import fs from 'node:fs';
import path from 'node:path';

export function writeFileAtomic(file, content, encoding = 'utf-8') {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, encoding);
  fs.renameSync(tmp, file);
}
