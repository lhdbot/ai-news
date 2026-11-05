import test from "node:test";
import assert from "node:assert/strict";
import { renderMarkdown } from "./markdown.ts";

test("Markdown 渲染移除原始 HTML 和危险链接", async () => {
  const html = await renderMarkdown(
    '# 标题\n<script>alert("xss")</script>\n[危险](javascript:alert(1))\n[安全](https://example.com)',
  );

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /javascript:/i);
  assert.match(html, /href="#"/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("Markdown 渲染移除图片事件处理器", async () => {
  const html = await renderMarkdown('<img src="x" onerror="alert(1)">');
  assert.doesNotMatch(html, /<img|onerror/i);
});
