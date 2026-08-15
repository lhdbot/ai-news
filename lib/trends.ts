import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const TaxonomyNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string().nullable(),
  stage: z.string().default(""),
  focus: z.string().default(""),
  keywords: z.array(z.string()).default([]),
});

const TaxonomySchema = z.object({
  nodes: z.array(TaxonomyNodeSchema),
});

const RadarTopItemSchema = z.object({
  title_zh: z.string().default(""),
  url: z.string(),
  date: z.string().default(""),
});

const RadarNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  parent: z.string().nullable().default(null),
  stage: z.string().default(""),
  focus: z.string().default(""),
  heat: z.number().default(0),
  count14d: z.number().default(0),
  last3d: z.number().default(0),
  prev3d: z.number().default(0),
  growth: z.number().default(0),
  topItems: z.array(RadarTopItemSchema).default([]),
});

const RadarSchema = z.object({
  generated_at: z.string(),
  nodes: z.array(RadarNodeSchema),
});

export type TaxonomyNode = z.infer<typeof TaxonomyNodeSchema>;
export type Taxonomy = z.infer<typeof TaxonomySchema>;
export type RadarNode = z.infer<typeof RadarNodeSchema>;
export type Radar = z.infer<typeof RadarSchema>;

const TRENDS_DIR = path.join(process.cwd(), "data", "trends");

function readJson<T>(file: string, schema: z.ZodType<T>): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return schema.parse(JSON.parse(fs.readFileSync(file, "utf-8")));
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
    return null;
  }
}

/** 趋势分类树；文件缺失或解析失败返回 null */
export function getTaxonomy(): Taxonomy | null {
  return readJson(path.join(TRENDS_DIR, "taxonomy.json"), TaxonomySchema);
}

/** 趋势雷达数据（由巡检任务生成）；文件缺失或解析失败返回 null */
export function getRadar(): Radar | null {
  return readJson(path.join(TRENDS_DIR, "radar.json"), RadarSchema);
}
