export const API_ORIGIN = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "" : "https://site-api.tscuite.workers.dev";
const SECRET_KEY = "mem_console_secret";

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
  const response = await fetch(API_ORIGIN + path, {
    method, body, headers, credentials: "omit", redirect: "error",
    signal: signal || AbortSignal.timeout(12000),
  });
  if (response.status === 401) throw new Error("密钥校验失败，请检查密钥及设备时间");
  if (!response.ok) throw new Error(`服务暂时不可用（${response.status}），请重试`);
  return response.json();
}
