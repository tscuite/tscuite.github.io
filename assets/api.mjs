export const API_ORIGIN = "https://memory.tscuite.workers.dev";
const SECRET_KEY = "mem_console_secret";
const SESSION_KEY = "desk_session";

export function savedSecret() {
  try { return sessionStorage.getItem(SECRET_KEY) || localStorage.getItem(SECRET_KEY) || ""; }
  catch { return ""; }
}
export function rememberSecret(secret) {
  sessionStorage.setItem(SECRET_KEY, secret); // New keys last only for this tab session.
}
export function forgetSecret() {
  sessionStorage.removeItem(SECRET_KEY);
  localStorage.removeItem(SECRET_KEY);
  localStorage.removeItem("mem_console_endpoint");
}
// 登录会话 token（iOS Safari/微信会拦第三方 cookie，用 token 顶住）
export function sessionToken() {
  try { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || ""; }
  catch { return ""; }
}
export function storeSessionToken(token) {
  try { localStorage.setItem(SESSION_KEY, token); sessionStorage.setItem(SESSION_KEY, token); } catch { /* 不阻断 */ }
}
export function clearSessionToken() {
  try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* 不阻断 */ }
}
const hex = bytes => [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");

export async function signatureHeaders(secret, method, path, body = "") {
  if (!secret) throw new Error("请输入管理密钥");
  const encoder = new TextEncoder();
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const bodyHash = hex(await crypto.subtle.digest("SHA-256", encoder.encode(body)));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const canonical = [method, path, timestamp, nonce, bodyHash].join("\n");
  return {
    "X-Auth-Timestamp": timestamp,
    "X-Auth-Nonce": nonce,
    "X-Auth-Signature": hex(await crypto.subtle.sign("HMAC", key, encoder.encode(canonical))),
  };
}

export async function api(path, { method = "GET", body, secret, signal } = {}) {
  if (!/^\/api\/[a-z0-9/]+(?:\?.*)?$/i.test(path)) throw new Error("不支持的接口路径");
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (secret !== undefined) Object.assign(headers, await signatureHeaders(secret, method, path, body));
  const token = sessionToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const response = await fetch(API_ORIGIN + path, {
    method, body, headers, credentials: "include", redirect: "error",
    signal: signal || AbortSignal.timeout(12000),
  });
  if (response.status === 401) throw new Error(secret !== undefined ? "密钥校验失败，请检查密钥及设备时间" : "请先登录");
  if (!response.ok) throw new Error(`服务暂时不可用（${response.status}），请重试`);
  return response.json();
}
