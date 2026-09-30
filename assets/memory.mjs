import { api, storeSessionToken, clearSessionToken } from "/assets/api.mjs";
const $ = (id) => document.getElementById(id);

const TARGETS = [
  ["", "全部"], ["memory", "memory"], ["user", "user"], ["failure", "failure"],
];
const HORIZONS = [
  ["", "全部周期"], ["daily", "daily"], ["weekly", "weekly"],
  ["monthly", "monthly"], ["permanent", "permanent"],
];

let me = null;
let state = { target: "", horizons: [], q: "", afterId: null, loading: false };
let activeRequest;

function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.hidden = false;
  setTimeout(() => { t.hidden = true; }, 3500);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function relTime(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso.replace(" ", "T") + "Z").getTime()) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)} 分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)} 小时前`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} 天前`;
  return iso.slice(0, 10);
}

function renderDate() {
  const today = new Date(new Date().getTime() + 8 * 3600000).toISOString().slice(0, 10);
  $("todayDate").dateTime = today;
  $("todayDate").textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Shanghai" }).format(new Date());
}
async function loadQuote() {
  try {
    const quote = await api("/api/public/quote");
    if (typeof quote.hitokoto !== "string" || !quote.hitokoto) throw new Error();
    $("hitokoto").textContent = quote.hitokoto;
    $("hitokotoFrom").textContent = quote.from || "一言";
  } catch {
    $("hitokoto").textContent = "";
    $("hitokotoFrom").textContent = "";
  }
}
renderDate(); loadQuote();

function cardHtml(m) {
  const targetClass = ["memory", "user", "failure"].includes(m.target) ? m.target : "plain";
  return `<div class="mem-row${me.isAdmin ? " clickable" : ""}" data-id="${m.id}">
    <div class="mem-head"><h3>${escapeHtml(m.subject || "（无标题）")}</h3></div>
    <div class="mem-text${me.isAdmin ? " snippet" : ""}">${escapeHtml(m.content || "")}</div>
    <div class="mem-meta">
      <span class="time" title="${escapeHtml(m.created_at || "")}">${relTime(m.created_at)}</span>
      <span class="pill ${targetClass}">${escapeHtml(m.target || "memory")}</span>
      <span class="pill plain">${escapeHtml(m.horizon || "daily")}</span>
    </div>
  </div>`;
}

async function loadAdmin(append) {
  if (append && state.loading) return;
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  state.loading = true;
  try {
    let data;
    if (state.q.trim().length >= 3) {
      const body = JSON.stringify({ q: state.q.trim(), target: state.target || null, horizons: state.horizons, limit: 20, bump_reference: false });
      data = await api("/api/memories/query", { method: "POST", body, signal: controller.signal });
    } else {
      const p = new URLSearchParams({ limit: "20", namespace: "default" });
      if (state.target) p.set("target", state.target);
      state.horizons.forEach((h) => p.append("horizon", h));
      if (append && state.afterId) p.set("after_id", state.afterId);
      data = await api("/api/memories?" + p.toString(), { signal: controller.signal });
    }
    if (controller.signal.aborted) return;
    const items = data.items || [];
    if (!append) $("list").innerHTML = "";
    $("list").insertAdjacentHTML("beforeend", items.map(cardHtml).join(""));
    state.afterId = state.q.trim().length >= 3 ? null : data.next_after_id;
    $("more").hidden = !state.afterId;
    $("empty").hidden = $("list").children.length > 0;
    $("memCount").textContent = `共 ${$("list").children.length} 条`;
  } catch (e) {
    if (controller.signal.aborted) return;
    toast(e.message);
  } finally {
    if (activeRequest === controller) state.loading = false;
  }
}

async function loadPublic(append) {
  if (append && state.loading) return;
  activeRequest?.abort();
  const controller = new AbortController();
  activeRequest = controller;
  state.loading = true;
  try {
    const p = new URLSearchParams({ limit: "20" });
    if (append && state.afterId) p.set("after_id", state.afterId);
    const data = await api("/api/public/memories?" + p.toString(), { signal: controller.signal });
    if (controller.signal.aborted) return;
    const items = data.items || [];
    if (!append) $("list").innerHTML = "";
    $("list").insertAdjacentHTML("beforeend", items.map(cardHtml).join(""));
    state.afterId = data.next_after_id;
    $("more").hidden = !state.afterId;
    $("empty").hidden = $("list").children.length > 0;
    if (!$("list").children.length) $("empty").textContent = "还没有公开内容";
    $("memCount").textContent = `共 ${$("list").children.length} 条公开内容`;
  } catch (e) {
    if (controller.signal.aborted) return;
    toast(e.message);
  } finally {
    if (activeRequest === controller) state.loading = false;
  }
}

const load = (append) => (me.isAdmin ? loadAdmin(append) : loadPublic(append));

async function openDetail(id) {
  try {
    const { item: m } = await api(`/api/memories/${id}`);
    if (!m) throw new Error("记忆不存在");
    const tags = (m.tags || []).map((t) => `#${escapeHtml(t)}`).join(" ");
    const reason = m.failure_reason ? `<b>failure_reason</b><span>${escapeHtml(m.failure_reason)}</span>` : "";
    $("drawerPanel").innerHTML = `
      <button class="drawer-close" id="drawerClose" aria-label="关闭详情">×</button>
      <h2>${escapeHtml(m.subject || "（无标题）")}</h2>
      <div class="content">${escapeHtml(m.content || "")}</div>
      <div class="kv">
        <b>id</b><span>${escapeHtml(m.id)}</span>
        <b>target</b><span>${escapeHtml(m.target || "-")}</span>
        <b>category</b><span>${escapeHtml(m.category || "-")}</span>
        <b>horizon</b><span>${escapeHtml(m.horizon || "-")}</span>
        <b>namespace</b><span>${escapeHtml(m.namespace || "-")} / ${escapeHtml(m.scope || "-")}</span>
        <b>created</b><span>${escapeHtml(m.created_at || "-")}</span>
        <b>tags</b><span>${tags || "-"}</span>
        ${reason}
      </div>`;
    $("drawerClose").onclick = closeDrawer;
    $("drawer").classList.add("open");
  } catch (e) { toast(e.message); }
}
function closeDrawer() { $("drawer").classList.remove("open"); }

function renderChips(container, options, active, key) {
  container.innerHTML = options.map(([v, label]) =>
    `<button class="filter ${((Array.isArray(active) ? active.includes(v) : active === v) || (v === "" && active.length === 0)) ? "active" : ""}" data-v="${v}" aria-pressed="false">${label}</button>`).join("");
  container.onclick = (e) => {
    const v = e.target.dataset.v;
    if (v === undefined) return;
    if (key === "target") state.target = v;
    else state.horizons = v === "" ? [] : (state.horizons.includes(v) ? state.horizons.filter((h) => h !== v) : [...state.horizons, v]);
    renderChips($("targetFilter"), TARGETS, state.target, "target");
    renderChips($("horizonFilter"), HORIZONS, state.horizons, "horizons");
    state.afterId = null; load(false);
  };
}

function renderUser() {
  $("userNav").hidden = !me;
  if (me) $("userNav").textContent = me.name || me.email;
}
function showApp() {
  delete document.documentElement.dataset.pending;
  $("authLoading").hidden = true;
  $("setup").hidden = true;
  $("app").hidden = false;
  renderUser();
  const mode = $("modeBanner");
  mode.classList.toggle("admin", Boolean(me.isAdmin));
  mode.lastChild.textContent = me.isAdmin
    ? "管理员模式：可见全部记忆"
    : "普通用户模式：仅公开内容，只读";
  $("adminUi").hidden = !me.isAdmin;
  $("feedbackPanel").hidden = !me.isAdmin;
  if (me.isAdmin) {
    renderChips($("targetFilter"), TARGETS, state.target, "target");
    renderChips($("horizonFilter"), HORIZONS, state.horizons, "horizons");
  }
  load(false);
}
function showSetup(clear = true) {
  delete document.documentElement.dataset.pending;
  $("authLoading").hidden = true;
  activeRequest?.abort();
  if (clear) clearSessionToken();
  me = null; $("list").replaceChildren(); closeDrawer();
  state.afterId = null;
  $("app").hidden = true; $("setup").hidden = false;
  renderUser();
}

$("connect").onclick = async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  if (!email || !password) return toast("填一下邮箱和密码");
  $("connect").disabled = true;
  try {
    const { user, token } = await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
    if (!user?.email) throw new Error("登录响应异常");
    if (token) storeSessionToken(token);
    me = user;
    $("password").value = "";
    showApp();
  } catch (e) {
    toast(e.message);
  } finally { $("connect").disabled = false; }
};

$("userNav").onclick = () => {
  $("accountEmail").textContent = me.email;
  $("accountRole").textContent = me.isAdmin ? "管理员" : "普通用户";
  $("accountRole").className = `role-badge${me.isAdmin ? " admin" : ""}`;
  $("accountDialog").showModal();
};
$("accountClose").onclick = () => $("accountDialog").close();
$("accountOk").onclick = () => $("accountDialog").close();
$("logoutBtn").onclick = async () => {
  try { await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }); } catch { /* 会话已失效也没关系 */ }
  $("accountDialog").close();
  showSetup();
  toast("已退出登录");
};

$("more").onclick = () => load(true);
$("memReload").onclick = () => load(false);
$("feedbackForm").onsubmit = async (e) => {
  e.preventDefault();
  const text = $("feedbackInput").value.trim();
  if (!text) return;
  $("feedbackInput").value = "";
  try {
    await api("/api/memories/feedback", { method: "POST", body: JSON.stringify({ text, target: state.target || null }) });
    toast("反馈已受理，稍后刷新可见");
  } catch (err) {
    toast(err.message);
  }
};
let debounce;
$("q").oninput = () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.q = $("q").value; state.afterId = null; load(false); }, 350);
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDrawer();
  if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) && !$("app").hidden) { e.preventDefault(); $("q").focus(); }
});
document.addEventListener("click", (e) => {
  const card = e.target.closest(".mem-row.clickable");
  if (card) openDetail(card.dataset.id);
});
$("drawer").addEventListener("click", (e) => { if (e.target === $("drawer")) closeDrawer(); });

(async () => {
  try {
    const { user } = await api("/api/auth/me");
    if (user?.email) { me = user; showApp(); return; }
    showSetup(true);
  } catch (error) {
    // 401 才清 token；网络/服务抖动时保留，下次刷新可自动恢复
    showSetup(error.message === "请先登录");
  }
})();
