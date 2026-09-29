#!/usr/bin/env node
// 账号管理（超管 key 签名）：
//   node tools/users.mjs add <email> [昵称]   → 建号，随机密码打印
//   node tools/users.mjs setpassword <email>  → 重置密码，随机密码打印
//   node tools/users.mjs admin <email>        → 设为管理员
//   node tools/users.mjs unadmin <email>      → 取消管理员
// 密钥从 ~/.agents/secrets.env 的 MEMORY_WORKER_API_SECRET 读取。
import { readFileSync } from "node:fs";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const BASE = "https://memory.tscuite.workers.dev";
const [cmd, email, ...rest] = process.argv.slice(2);
if (!cmd || !email) {
  console.error("用法：node tools/users.mjs <add|setpassword|admin|unadmin> <email> [昵称]");
  process.exit(1);
}
const secretsFile = join(homedir(), ".agents", "secrets.env");
const line = readFileSync(secretsFile, "utf8").split("\n").find((row) => row.startsWith("MEMORY_WORKER_API_SECRET="));
if (!line) { console.error("secrets.env 里没有 MEMORY_WORKER_API_SECRET"); process.exit(1); }
const secret = line.slice("MEMORY_WORKER_API_SECRET=".length).trim();

const generated = randomBytes(9).toString("base64url");
const payload = { email: email.toLowerCase() };
if (cmd === "add") {
  payload.password = generated;
  if (rest[0]) payload.name = rest[0];
} else if (cmd === "setpassword") {
  payload.password = generated;
} else if (cmd === "admin") {
  payload.admin = true;
} else if (cmd === "unadmin") {
  payload.admin = false;
} else {
  console.error("未知命令，可用：add / setpassword / admin / unadmin");
  process.exit(1);
}

const path = "/api/admin/users";
const body = JSON.stringify(payload);
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomBytes(16).toString("hex");
const signature = createHmac("sha256", secret)
  .update([`POST\n${path}\n${timestamp}\n${nonce}`, createHash("sha256").update(body).digest("hex")].join("\n"))
  .digest("hex");
const response = await fetch(BASE + path, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Auth-Timestamp": timestamp, "X-Auth-Nonce": nonce, "X-Auth-Signature": signature },
  body,
});
const result = await response.json();
if (!response.ok) {
  console.error("操作失败：", result.error || `HTTP ${response.status}`);
  process.exit(1);
}
console.log(`ok: ${email} ${result.created ? "已建号" : "已更新"}`);
if (generated && (cmd === "add" || cmd === "setpassword")) console.log(`初始密码：${generated}`);
