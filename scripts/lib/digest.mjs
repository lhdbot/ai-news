/**
 * 每日精选（digest）选择：从当日原始条目里挑最多 30 条。
 * 优先当日首次出现（isNew），再按分类配额，最后按热度补足；
 * 跨天重复的条目只有热度很高时才回到 digest。
 */
import { normalizeUrl } from './url-index.mjs';

export const DIGEST_SIZE = 30;
// 合计 30：配额是硬上限，保证七个板块的版面比例稳定
export const CATEGORY_QUOTAS = {
  论文研究: 5,
  模型发布: 4,
  行业动态: 7,
  工具产品: 7,
  芯片算力: 3,
  具身智能: 2,
  人物经验: 2,
};

export function itemScore(item) {
  const heat = Number(item.heat) || 10;
  const multi = (item.relatedSources?.length ?? 0) * 2;
  const summarized = item.summarized ? 1 : 0;
  return heat + multi + summarized;
}

export function selectDigest(items, index, date, { size = DIGEST_SIZE, quotas = CATEGORY_QUOTAS } = {}) {
  const urls = index?.urls || {};
  const isNew = (item) => {
    const rec = urls[normalizeUrl(item.url)];
    if (rec && rec.firstSeenAt) return rec.firstSeenAt === date;
    return Boolean(item.added_at && String(item.added_at).slice(0, 10) === date);
  };
  const sorted = [...items].sort((a, b) => {
    const byNew = Number(isNew(b)) - Number(isNew(a));
    if (byNew !== 0) return byNew;
    return itemScore(b) - itemScore(a);
  });

  const seen = new Set();
  const out = [];
  const counts = new Map();
  const take = (item, reason) => {
    const key = normalizeUrl(item.url);
    if (seen.has(key) || out.length >= size) return false;
    seen.add(key);
    out.push({ ...item, position: out.length + 1, isNew: isNew(item), reason });
    counts.set(item.category, (counts.get(item.category) || 0) + 1);
    return true;
  };

  for (const [category, quota] of Object.entries(quotas)) {
    // 先当日新增，再历史高热补位；两类都不超过该分类配额
    for (const item of sorted) {
      if ((counts.get(category) || 0) >= quota) break;
      if (item.category !== category || !isNew(item)) continue;
      take(item, 'category_quota');
    }
    for (const item of sorted) {
      if ((counts.get(category) || 0) >= quota) break;
      if (item.category !== category || isNew(item)) continue;
      take(item, 'high_heat');
    }
  }
  return out;
}
