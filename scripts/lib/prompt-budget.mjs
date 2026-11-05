/**
 * Windows 命令行（CreateProcess）上限约 32K 字符。Kimi CLI 只能用 `kimi -p <prompt>`
 * 传 prompt，素材一多就会触发 spawn ENAMETOOLONG。这里做确定性裁剪：
 *   1) 先去掉每条素材的 summary 字段；
 *   2) 仍超限则按比例减少条目数（保留最近的，minItems 保底）。
 */
export const MAX_PROMPT_CHARS = 26000;

export function fitPrompt(items, build, { maxChars = MAX_PROMPT_CHARS, minItems = 12 } = {}) {
  let list = items;
  let prompt = build(list);
  if (prompt.length <= maxChars) return { prompt, items: list, trimmed: false };

  if (list.some((it) => 'summary' in it)) {
    list = list.map((it) => {
      const copy = { ...it };
      delete copy.summary;
      return copy;
    });
    prompt = build(list);
  }

  while (prompt.length > maxChars && list.length > minItems) {
    const keep = Math.max(
      minItems,
      Math.floor(list.length * (maxChars / prompt.length) * 0.95),
    );
    if (keep >= list.length) break;
    list = list.slice(0, keep);
    prompt = build(list);
  }

  return { prompt, items: list, trimmed: true };
}
