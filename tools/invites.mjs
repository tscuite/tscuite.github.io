#!/usr/bin/env node
// 生成邀请码：node tools/invites.mjs [数量]
// 密钥从 ~/.agents/secrets.env 的 MEMORY_WORKER_API_SECRET 读取，不出现在命令行或输出中。
import { readFileSync } from "node:fs";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const GATEWAY = "https://site-api.tscuite.workers.dev";
const count = Math.min(20, Math.max(1, Number.parseInt(process.argv[2], 10) || 1));
const secretsFile = join(homedir(), ".agents", "secrets.env");
const line = readFileSync(secretsFile, "utf8")
  .split("\n")
  .find((row) => row.startsWith("MEMORY_WORKER_API_SECRET="));
if (!line) {
  console.error("secrets.env 里没有 MEMORY_WORKER_API_SECRET");
  process.exit(1);
}
const secret = line.slice("MEMORY_WORKER_API_SECRET=".length).trim();
const path = "/api/invites";
const body = JSON.stringify({ count });
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomBytes(16).toString("hex");
const signature = createHmac("sha256", secret)
  .update([`POST\n${path}\n${timestamp}\n${nonce}`, createHash("sha256").update(body).digest("hex")].join("\n"))
  .digest("hex");
const response = await fetch(GATEWAY + path, {
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
  console.error("生成失败：", result.error || `HTTP ${response.status}`);
  process.exit(1);
}
console.log(result.codes.join("\n"));
