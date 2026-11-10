import test from "node:test";
import assert from "node:assert/strict";
import { apiError, apiJson, isValidDate, parseKind, parseNewsView } from "./api.ts";

test("日期校验接受真实日期和闰日", () => {
  assert.equal(isValidDate("2024-02-29"), true);
  assert.equal(isValidDate("2026-10-26"), true);
});

test("日期校验拒绝非法日期和路径输入", () => {
  for (const value of [
    "2023-02-29",
    "2026-13-01",
    "2026-1-01",
    "../../etc/passwd",
    "2026-01-01/extra",
  ]) {
    assert.equal(isValidDate(value), false, value);
  }
});

test("kind 默认 daily，仅接受 daily 和 weekly", () => {
  assert.equal(parseKind(null), "daily");
  assert.equal(parseKind("daily"), "daily");
  assert.equal(parseKind("weekly"), "weekly");
  assert.equal(parseKind(""), null);
  assert.equal(parseKind("monthly"), null);
});

test("API 响应禁止缓存，错误结构保持一致", async () => {
  const success = apiJson({ ok: true });
  assert.equal(success.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await success.json(), { ok: true });

  const error = apiError(400, "invalid_date", "bad date");
  assert.equal(error.status, 400);
  assert.equal(error.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await error.json(), {
    error: { code: "invalid_date", message: "bad date" },
  });
});

test("view 默认 full，仅接受 full 和 digest", () => {
  assert.equal(parseNewsView(null), "full");
  assert.equal(parseNewsView("full"), "full");
  assert.equal(parseNewsView("digest"), "digest");
  assert.equal(parseNewsView("other"), null);
});
