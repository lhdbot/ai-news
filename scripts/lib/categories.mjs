/**
 * 专用来源的分类是"事实"而非观点：arXiv 的条目就是论文，NVIDIA 博客属于芯片算力，
 * 宇树/智元的提交属于具身智能，人物博客属于人物经验。
 * LLM 重新分类时允许改通用媒体，但不允许把论文改成"工具产品"——否则首页板块会被挤空。
 */
export const LOCKED_SOURCE_RULES = [
  [/arxiv|hugging face daily papers|microsoft research/i, '论文研究'],
  [/unitree|agibot/i, '具身智能'],
];

/** 返回来源对应的固定分类；通用媒体返回 null（交给 LLM 判断） */
export function lockedCategory(source) {
  for (const [re, category] of LOCKED_SOURCE_RULES) {
    if (re.test(source ?? '')) return category;
  }
  return null;
}
