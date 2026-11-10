/**
 * 语义抽检的取样与均分：
 * - 按日期做种子的确定性洗牌（同一天多次运行选同一批，便于比较）；
 * - 按分类轮转取样，保证覆盖不同板块；
 * - 均分只统计四维评分都合法的条目。
 */
function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function mulberry32(a) {
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function selectSample(items, count = 5, seed = '') {
  const pool = (items || []).filter(
    (item) => item && item.summarized && (item.title_zh || item.title) && item.summary_zh,
  );
  const rnd = mulberry32(hashSeed(String(seed)));
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const byCategory = new Map();
  for (const item of shuffled) {
    const list = byCategory.get(item.category) || [];
    list.push(item);
    byCategory.set(item.category, list);
  }
  const picked = [];
  let round = 0;
  while (picked.length < count) {
    let added = false;
    for (const list of byCategory.values()) {
      if (list.length > round && picked.length < count) {
        picked.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
    round += 1;
  }
  return picked;
}

export const SCORE_KEYS = ['accuracy', 'density', 'readability', 'actionability'];

export function averageScores(reviews) {
  const valid = (reviews || []).filter((r) =>
    SCORE_KEYS.every((k) => Number.isFinite(Number(r[k])) && Number(r[k]) >= 1 && Number(r[k]) <= 5),
  );
  if (valid.length === 0) return null;
  const out = {};
  for (const key of SCORE_KEYS) {
    out[key] = Math.round((valid.reduce((sum, r) => sum + Number(r[key]), 0) / valid.length) * 10) / 10;
  }
  return out;
}
