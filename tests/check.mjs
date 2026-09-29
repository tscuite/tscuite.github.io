import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHmac, createHash } from "node:crypto";
import gateway from "../gateway/worker.mjs";
import { parseRepositories, normalizeFoods, nextRest, restInfo, chinaDate } from "../assets/core.mjs";

globalThis.location = { hostname: "tscuite.github.io" };
const { signatureHeaders } = await import("../assets/api.mjs");
const originalFetch = globalThis.fetch;
const cache = new Map();
globalThis.caches = { default: {
  async match(request) { return cache.get(request.url)?.clone(); },
  async put(request, response) { cache.set(request.url, response); },
} };
const pending = [], ctx = { waitUntil(p) { pending.push(p); } };
const site = "https://tscuite.github.io", base = "https://site-api.tscuite.workers.dev";
const testKey = "test-only-not-a-real-key";
let calls = 0, lastRequest;
const env = { MEMORY: { async fetch(request) {
  calls++;
  const body = await request.text();
  lastRequest = { url: request.url, method: request.method, body, headers: request.headers };
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/public/")) {
    const canonical = [request.method, url.pathname + url.search, request.headers.get("X-Auth-Timestamp"), request.headers.get("X-Auth-Nonce"), createHash("sha256").update(body).digest("hex")].join("\n");
    const valid = createHmac("sha256", testKey).update(canonical).digest("hex") === request.headers.get("X-Auth-Signature");
    return Response.json({ ok: valid }, { status: valid ? 200 : 401, headers: { "Set-Cookie": "internal=secret", "Access-Control-Allow-Origin": "*" } });
  }
  return Response.json({ foods: ["火锅", "面条"] }, { headers: { "Access-Control-Allow-Origin": "*", "X-Request-Id": "private-diagnostic" } });
} } };
const call = (path, init = {}) => gateway.fetch(new Request(base + path, init), env, ctx);

assert.deepEqual(normalizeFoods("火锅\n面条 火锅"), ["火锅", "面条"]);
assert.throws(() => normalizeFoods(" "));
assert.throws(() => normalizeFoods("菜".repeat(31)));
const repos = parseRepositories("近 7 天新建\n\nowner/repo ★2,283・Python\n包含 <script> 的文本\n\norg/name ★12・Rust\n描述\n\n数据来源：GitHub");
assert.equal(repos.length, 2);
assert.equal(repos[0].stars, 2283);
assert.equal(repos[0].description, "包含 <script> 的文本");
assert.equal(repos[1].description, "描述");
assert.equal(repos[0].url, "https://github.com/owner/repo");
assert.equal(parseRepositories("../redirect ★2・HTML").length, 0);
const years = {
  "2026": [{ Name: "国庆节", StartDate: "2026-10-01", EndDate: "2026-10-07", CompDays: ["2026-09-20", "2026-10-10"] }],
  "2027": [{ Name: "元旦", StartDate: "2027-01-01", EndDate: "2027-01-03", CompDays: [] }],
};
assert.equal(nextRest(years, "2026-09-29").days, 2);
assert.equal(nextRest(years, "2026-09-29").name, "国庆节");
assert.equal(restInfo(years, "2026-10-10").rest, false);
assert.equal(nextRest(years, "2026-10-09").date, "2026-10-11");
assert.equal(nextRest(years, "2026-10-01").days, 0);
assert.equal(nextRest(years, "2026-12-31").date, "2027-01-01");
assert.equal(restInfo({}, "2027-01-01").known, false);
assert.equal(chinaDate(new Date("2026-09-30T16:01:00Z")), "2026-10-01");

assert.equal((await call("/api/not-allowed")).status, 404);
assert.equal((await call("/api/memories/reindex", { method: "POST" })).status, 404);
assert.equal((await call("/api/config/foods", { method: "PUT", body: "{}" })).status, 401);
assert.equal((await call("/api/public/config/foods", { method: "PUT" })).status, 405);
assert.equal((await call("/api/public/config/foods", { headers: { Origin: "https://untrusted.example" } })).status, 403);
assert.equal(calls, 0);
const preflight = await call("/api/config/foods", { method: "OPTIONS", headers: { Origin: site, "Access-Control-Request-Method": "PUT" } });
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), site);
assert.equal((await call("/api/config/foods", { method: "OPTIONS", headers: { Origin: site, "Access-Control-Request-Method": "DELETE" } })).status, 405);

const publicResponse = await call("/api/public/config/holidays", { headers: { Origin: site } });
assert.equal(publicResponse.status, 200);
assert.equal(publicResponse.headers.get("Access-Control-Allow-Origin"), site);
assert.equal(publicResponse.headers.get("X-Request-Id"), null);
await Promise.all(pending);
const beforeCache = calls;
const cached = await call("/api/public/config/holidays");
assert.equal(cached.status, 200);
assert.equal(calls, beforeCache);
assert.equal(cached.headers.get("Access-Control-Allow-Origin"), null);

for (const [method, path, body] of [
  ["GET", "/api/memories?limit=1&scope=assistant", undefined],
  ["POST", "/api/memories/query", '{"q":"中文 查询", "bump_reference":false}'],
  ["PUT", "/api/config/foods", '{"foods":["火锅","面条"]}'],
]) {
  const headers = { Origin: site, ...(await signatureHeaders(testKey, method, path, body)) };
  const result = await call(path, { method, body, headers });
  assert.equal(result.status, 200, `HMAC preserved for ${path}`);
  assert.equal(lastRequest.url, base + path);
  assert.equal(lastRequest.body, body || "");
  assert.equal(result.headers.get("Cache-Control"), "no-store");
  assert.equal(result.headers.get("Set-Cookie"), null);
  assert.equal(cache.has(base + path), false);
}
const invalid = await signatureHeaders("wrong", "GET", "/api/memories?limit=1");
assert.equal((await call("/api/memories?limit=1", { headers: invalid })).status, 401);
assert.equal((await call("/api/config/foods", { method: "PUT", body: "a".repeat(65537), headers: invalid })).status, 413);

let externalCalls = 0;
globalThis.fetch = async (url, options) => { externalCalls++; assert.match(url, /^https:\/\/(api.open-meteo.com|v1.hitokoto.cn)\//); assert.equal(options.redirect, "error"); return Response.json({ weather: true }); };
assert.equal((await call("/api/public/weather?url=https://untrusted.example")).status, 400);
assert.equal(externalCalls, 0);
assert.equal((await call("/api/public/weather")).status, 200);
assert.equal(externalCalls, 1);
globalThis.fetch = originalFetch;

for (const name of ["index.html", "memory/index.html", "assets/api.mjs", "assets/desk.mjs"]) {
  const text = await readFile(new URL("../" + name, import.meta.url), "utf8");
  assert.ok(!text.includes("https://memory."), `No original backend URL in ${name}`);
}
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../assets/desk.mjs", import.meta.url), "utf8");
for (const match of app.matchAll(/\$\("([\w-]+)"\)/g)) assert.ok(html.includes(`id="${match[1]}"`), `Missing DOM id ${match[1]}`);
console.log("PASS: parsing, menu validation, holiday/timezone boundaries, HMAC proxy, route/method/origin guards, public-only caching, private no-store, body limit, external allowlist, frontend wiring");
