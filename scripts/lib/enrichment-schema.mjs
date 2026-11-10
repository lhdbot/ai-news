/**
 * LLM 摘要输出的结构化校验。长度上限刻意放宽（只拦截缺失/非法/明显异常），
 * 避免因为模型多说几个字就把整条丢进失败队列。
 */
import { z } from 'zod';

export const ENRICHMENT_CATEGORIES = ['模型发布', '论文研究', '行业动态', '工具产品', '芯片算力', '具身智能', '人物经验'];

export const EnrichmentSchema = z.object({
  id: z.string().min(1),
  title_zh: z.string().min(1).max(120),
  summary_zh: z.string().min(5).max(240),
  learn: z.string().max(240).default(''),
  impact: z.string().max(240).default(''),
  advice: z.string().max(240).default(''),
  category: z.enum(ENRICHMENT_CATEGORIES),
  tags: z.array(z.string().min(1)).max(5).default([]),
  trends: z.array(z.string()).max(3).default([]),
  method: z.string().max(400).optional(),
  result: z.string().max(400).optional(),
  limitation: z.string().max(400).optional(),
});

export function validateEnrichment(value) {
  const result = EnrichmentSchema.safeParse(value);
  if (result.success) return { ok: true, data: result.data };
  const reason = result.error.issues
    .map((i) => `${i.path.join('.') || 'item'}: ${i.message}`)
    .join('; ')
    .slice(0, 300);
  return { ok: false, reason };
}
