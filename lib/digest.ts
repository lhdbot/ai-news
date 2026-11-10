import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { NewsItemSchema } from "./news";

const DigestItemSchema = NewsItemSchema.extend({
  position: z.number(),
  isNew: z.boolean(),
  reason: z.string().default(""),
});

const DailyDigestSchema = z.object({
  date: z.string(),
  generated_at: z.string(),
  total: z.number().default(0),
  items: z.array(DigestItemSchema),
});

export type DigestItem = z.infer<typeof DigestItemSchema>;
export type DailyDigest = z.infer<typeof DailyDigestSchema>;

const DIGEST_DIR = path.join(process.cwd(), "data", "digests");
const cache = new Map<string, { mtimeMs: number; data: DailyDigest | null }>();

/** 读取某天的精选；未生成或解析失败返回 null（页面回退到全量日报） */
export function getDigest(date: string): DailyDigest | null {
  const file = path.join(DIGEST_DIR, `${date}.json`);
  let mtimeMs: number;
  try {
    mtimeMs = fs.statSync(file).mtimeMs;
  } catch {
    return null;
  }
  const hit = cache.get(file);
  if (hit && hit.mtimeMs === mtimeMs) return hit.data;
  let data: DailyDigest | null = null;
  try {
    const raw = fs.readFileSync(file, "utf-8").replace(/^\uFEFF/, "");
    data = DailyDigestSchema.parse(JSON.parse(raw));
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
  }
  cache.set(file, { mtimeMs, data });
  return data;
}
