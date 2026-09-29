#!/usr/bin/env node
// 手动更新 GitHub 每日热门快照：node tools/trending.mjs
// 触发 worker 拉取 GitHub Search API（近 7 天新建、按 Star、前 30），队列异步生成。
// 密钥从 ~/.agents/secrets.env 的 TRENDING_REFRESH_KEY 读取（只授权 trending 更新的专用密钥）。
import { readFileSync } from "node:fs";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "https://memory.tscuite.workers.dev";
const path = "/api/config/trending/refresh";
const secretsFile = join(homedir(), ".agents", "secrets.env");
const line = readFileSync(secretsFile, "utf8").split("\n").find((row) => row.startsWith("TRENDING_REFRESH_KEY="));
if (!line) { console.error("secrets.env 里没有 TRENDING_REFRESH_KEY"); process.exit(1); }
const secret = line.slice("TRENDING_REFRESH_KEY=".length).trim();

const body = "{}";
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomBytes(16).toString("hex");
const signature = createHmac("sha256", secret)
  .update([`POST\n${path}\n${timestamp}\n${nonce}`, createHash("sha256").update(body).digest("hex")].join("\n"))
  .digest("hex");
const response = await fetch(BASE + path, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Auth-Timestamp": timestamp,
    "X-Auth-Nonce": nonce,
    "X-Auth-Signature": signature,
  },
  body,
});
const result = await response.json();
if (!response.ok) {
  console.error("更新失败：", result.error || `HTTP ${response.status}`);
  process.exit(1);
}
console.log("已入队，约 20 秒后主页自动可见新快照。");
