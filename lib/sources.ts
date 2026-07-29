import fs from "node:fs";
import path from "node:path";

/** 信息源配置（data/sources.json 的单一来源，抓取脚本和页脚共用） */
export type SourceInfo = {
  name: string;
  url: string;
  type: "rss" | "hf" | "trending";
  weight: number;
  category: string;
  /** 来源首页，页脚展示链接用；缺省回退到 url */
  site?: string;
};

export function getSources(): SourceInfo[] {
  const file = path.join(process.cwd(), "data", "sources.json");
  try {
    return JSON.parse(fs.readFileSync(file, "utf-8")) as SourceInfo[];
  } catch (err) {
    console.error(`Failed to parse ${file}:`, err);
    return [];
  }
}
