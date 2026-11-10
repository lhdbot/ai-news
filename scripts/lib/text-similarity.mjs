/**
 * 标题相似度：中文按字符 bigram、英文按词切分，返回 Jaccard。
 * fetch-news（单次抓取内事件合并）与 events（跨天事件聚合）共用。
 */
export function titleTokens(title) {
  const text = (title ?? '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return new Set();
  const tokens = new Set();
  const runs = text.match(/[\p{Script=Han}]+|[^\p{Script=Han}\s]+/gu) ?? [];
  for (const run of runs) {
    if (run.length === 1) {
      tokens.add(`c:${run}`);
      continue;
    }
    if (/^[\p{Script=Han}]+$/u.test(run)) {
      for (let i = 0; i + 1 < run.length; i++) {
        tokens.add(`c:${run[i]}${run[i + 1]}`);
      }
    } else {
      tokens.add(`w:${run}`);
    }
  }
  return tokens;
}

export function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}
