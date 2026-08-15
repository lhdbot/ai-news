#!/usr/bin/env node
/**
 * 数据变化检测（替代原先 git add/diff 的重建触发器）
 *
 * 用法：
 *   node scripts/data-changed.mjs --mark   记录当前数据指纹到 logs/.data-hash
 *   node scripts/data-changed.mjs --check  与上次指纹比较：有变化 exit 0（并重新记录），无变化 exit 1
 *
 * 指纹只取"有意义"的信号，避免被每次运行都变的 generated_at 干扰：
 *   - data/news/*.json：每天条数 + 全部条目 id + 已摘要条数
 *   - data/impact|forecasts 下的文件名与大小
 *   （radar.json 随新闻变化而变，不单独纳入）
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const HASH_FILE = path.join(ROOT, "logs", ".data-hash");

function fingerprint() {
  const h = crypto.createHash("sha1");

  const newsDir = path.join(ROOT, "data", "news");
  if (fs.existsSync(newsDir)) {
    for (const f of fs.readdirSync(newsDir).filter((f) => f.endsWith(".json")).sort()) {
      try {
        const d = JSON.parse(fs.readFileSync(path.join(newsDir, f), "utf-8"));
        const items = d.items ?? [];
        h.update(f);
        h.update(String(items.length));
        h.update(items.map((it) => it.id).join(","));
        h.update(String(items.filter((it) => it.summarized).length));
      } catch { /* 跳过坏文件 */ }
    }
  }

  for (const sub of ["impact", "forecasts"]) {
    const base = path.join(ROOT, "data", sub);
    if (!fs.existsSync(base)) continue;
    const walk = (dir) => {
      for (const name of fs.readdirSync(dir).sort()) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else {
          h.update(path.relative(ROOT, p));
          h.update(String(st.size));
        }
      }
    };
    walk(base);
  }
  return h.digest("hex");
}

const mode = process.argv[2];
const current = fingerprint();
let previous = null;
try {
  previous = fs.readFileSync(HASH_FILE, "utf-8").trim();
} catch { /* 首次运行 */ }

if (mode === "--mark") {
  fs.mkdirSync(path.dirname(HASH_FILE), { recursive: true });
  fs.writeFileSync(HASH_FILE, current + "\n", "utf-8");
  console.log(`[ok] 数据指纹已记录: ${current.slice(0, 12)}`);
  process.exit(0);
}

if (mode === "--check") {
  fs.mkdirSync(path.dirname(HASH_FILE), { recursive: true });
  fs.writeFileSync(HASH_FILE, current + "\n", "utf-8");
  if (current === previous) {
    console.log("[info] 数据无变化，跳过重建");
    process.exit(1);
  }
  console.log(`[ok] 数据有变化: ${(previous ?? "none").slice(0, 12)} -> ${current.slice(0, 12)}`);
  process.exit(0);
}

console.error("用法: node scripts/data-changed.mjs --mark|--check");
process.exit(2);
