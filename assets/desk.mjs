import { api, storeSessionToken, clearSessionToken } from "./api.mjs";
import { updateChat } from "./chat.mjs";
import { LANGUAGE_COLORS, REPO_LINE, parseRepositories, normalizeFoods, chinaDate, dayNumber, addDays, dayOfWeek, restInfo, nextRest } from "./core.mjs";
const $ = id => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};
function icon(name, small = false) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon" + (small ? " small" : ""));
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS(svg.namespaceURI, "use");
  use.setAttribute("href", "#i-" + name);
  svg.append(use);
  return svg;
}
let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  $("toast").textContent = message;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 3500);
}

function updateThemeButton() {
  const next = document.documentElement.dataset.theme === "dark" ? "浅色" : "深色";
  $("themeToggle").setAttribute("aria-label", `切换${next}模式`);
  $("themeToggle").title = `切换${next}模式`;
}
$("themeToggle").onclick = () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem("desk-theme", theme); } catch { /* Theme still works without storage. */ }
  updateThemeButton();
};
updateThemeButton();
function renderDate() {
  const today = chinaDate();
  $("todayDate").dateTime = today;
  $("todayDate").textContent = new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Shanghai" }).format(new Date());
}
renderDate();

let foods = ["麻辣烫", "火锅", "面条", "黄焖鸡", "饺子"];
let foodsLoaded = false;
let rolling = false;
let me = null; // 登录用户：{ email, name }

async function initAuth() {
  try {
    const { user } = await api("/api/auth/me");
    if (user?.email) me = user;
  } catch { me = null; }
  renderUser();
  await loadFoods(); // 登录态确定后再拉菜单，避免拿到默认菜单
}
function renderUser() {
  const chip = $("userNav");
  chip.textContent = me ? (me.name || me.email) : "登录";
  chip.title = me ? `${me.email} · 点击打开账号面板` : "登录后可以定制自己的菜单并加入聊天";
  updateChat(me);
}
async function loadFoods() {
  $("foodEdit").disabled = true;
  try {
    const data = me ? await api("/api/foods") : await api("/api/public/config/foods");
    if (!Array.isArray(data.foods) || !data.foods.length || data.foods.some(f => typeof f !== "string" || !f.trim())) throw new Error("菜单数据不完整");
    foods = data.foods;
    foodsLoaded = true;
    $("foodStatus").textContent = me ? `${foods.length} 个备选 · 你的菜单` : `${foods.length} 个备选 · 默认菜单`;
  } catch {
    foodsLoaded = false;
    $("foodStatus").textContent = "云端暂不可用，先用默认菜单";
  } finally {
    $("foodEdit").disabled = false;
  }
  if (!rolling) $("foodName").textContent = foods[dayNumber(chinaDate()) % foods.length];
}
function scatter(word) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const node = element("span", "food-float", word);
  node.setAttribute("aria-hidden", "true");
  node.style.left = `${10 + Math.random() * 60}%`;
  $("foodBody").append(node);
  setTimeout(() => node.remove(), 950);
}
$("reroll").onclick = () => {
  if (rolling) return;
  rolling = true;
  $("reroll").disabled = true;
  const previous = $("foodName").textContent;
  $("foodHint").textContent = "让我想想…";
  const finish = () => {
    const candidates = foods.filter(f => f !== previous);
    const pool = candidates.length ? candidates : foods;
    $("foodName").textContent = pool[Math.floor(Math.random() * pool.length)];
    $("foodHint").textContent = "就吃这个，不纠结了。";
    $("reroll").querySelector("span").textContent = "不行，再选一次";
    $("reroll").disabled = false;
    rolling = false;
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
  let ticks = 0;
  const timer = setInterval(() => {
    const word = foods[Math.floor(Math.random() * foods.length)];
    $("foodName").textContent = word;
    if (ticks % 3 === 0) scatter(word);
    if (++ticks === 14) { clearInterval(timer); finish(); }
  }, 70);
};
$("foodEdit").onclick = async () => {
  if (!me) { $("registerDialog").showModal(); return; }
  if (!foodsLoaded) await loadFoods();
  if (!foodsLoaded) return toast("未能读取云端清单，请稍后重试");
  $("foodListText").value = foods.join("\n");
  $("saveStatus").textContent = "";
  $("foodDialog").showModal();
};
$("foodCancel").onclick = () => $("foodDialog").close();
$("foodForm").onsubmit = async event => {
  event.preventDefault();
  if ($("foodSave").disabled) return;
  const status = $("saveStatus");
  status.classList.remove("error");
  try {
    const next = normalizeFoods($("foodListText").value);
    $("foodSave").disabled = true;
    status.textContent = "正在保存…";
    await api("/api/foods", { method: "PUT", body: JSON.stringify({ foods: next }) });
    foods = next;
    $("foodName").textContent = foods[dayNumber(chinaDate()) % foods.length];
    $("foodStatus").textContent = `${foods.length} 个备选 · 你的菜单`;
    $("foodDialog").close();
    toast(`已保存 ${foods.length} 个选项`);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  } finally { $("foodSave").disabled = false; }
};

// ---- 登录 / 注册 / 退出（邀请码） ----
$("userNav").onclick = () => {
  if (me) {
    $("accountEmail").textContent = me.email;
    $("accountRole").textContent = me.isAdmin ? "管理员" : "普通用户";
    $("accountRole").className = `role-badge${me.isAdmin ? " admin" : ""}`;
    $("accountFoods").textContent = foodsLoaded ? `${foods.length} 个备选` : "读取中…";
    $("accountDialog").showModal();
  } else {
    $("registerStatus").textContent = "";
    $("registerDialog").showModal();
  }
};
$("accountClose").onclick = () => $("accountDialog").close();
$("accountOk").onclick = () => $("accountDialog").close();
$("logoutBtn").onclick = async () => {
  try { await api("/api/auth/logout", { method: "POST", body: JSON.stringify({}) }); } catch { /* 会话已失效也没关系 */ }
  clearSessionToken();
  me = null;
  $("accountDialog").close();
  renderUser();
  loadFoods();
  toast("已退出登录");
};
$("registerCancel").onclick = () => $("registerDialog").close();
$("registerForm").onsubmit = async event => {
  event.preventDefault();
  if ($("registerSubmit").disabled) return;
  const status = $("registerStatus");
  status.classList.remove("error");
  $("registerSubmit").disabled = true;
  status.textContent = "正在登录…";
  try {
    const { user, token } = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: $("registerEmail").value.trim(),
        password: $("registerPassword").value,
      }),
    });
    if (!user?.email) throw new Error("登录响应异常");
    if (token) storeSessionToken(token);
    me = user;
    renderUser();
    $("registerDialog").close();
    $("registerForm").reset();
    $("registerStatus").textContent = "";
    loadFoods();
    toast(`欢迎，${me.name || me.email}`);
  } catch (error) {
    status.textContent = error.message;
    status.classList.add("error");
  } finally { $("registerSubmit").disabled = false; }
};

let holidayYears = {};
function renderRest() {
  const today = chinaDate(), next = nextRest(holidayYears, today);
  const known = restInfo(holidayYears, today).known && next?.known;
  $("restLabel").textContent = known ? "含法定调休" : "仅按周末估算";
  if (next) {
    $("restDays").textContent = next.days === 0 ? "休" : next.days;
    $("restUnit").textContent = next.days === 0 ? `${next.name}休息中` : `天后 · ${next.name}`;
    $("restDate").textContent = `${next.date.replaceAll("-", ".")} 星期${"日一二三四五六"[dayOfWeek(next.date)]}`;
  }
  const week = document.createDocumentFragment();
  for (let n = 0; n < 7; n++) {
    const date = addDays(today, n), info = restInfo(holidayYears, date);
    const pill = element("div", `day-pill${info.rest ? " rest" : ""}${n === 0 ? " today" : ""}`);
    pill.title = `${date} ${info.name}${info.known ? "" : "（估算）"}`;
    pill.setAttribute("aria-label", pill.title);
    pill.append(element("span", "", n === 0 ? "今" : "日一二三四五六"[dayOfWeek(date)]), element("strong", "", date.slice(-2)));
    week.append(pill);
  }
  $("weekStrip").replaceChildren(week);
  const upcoming = Object.values(holidayYears).flat().filter(h => h.StartDate > today).sort((a, b) => a.StartDate.localeCompare(b.StartDate))[0];
  $("holidayHint").textContent = known
    ? (upcoming ? `${upcoming.Name} ${upcoming.StartDate.slice(5).replace("-", "/")} 开始 · 蓝色为休息日` : "蓝色为休息日，已排除调休补班")
    : "当年调休表暂无数据，补班日可能有偏差";
}
async function loadHolidays() {
  try { holidayYears = (await api("/api/public/config/holidays")).Years || {}; }
  catch { holidayYears = {}; }
  renderRest();
}
const WMO = code => code === 0 ? "晴" : code <= 2 ? "晴间多云" : code === 3 ? "阴" : code <= 48 ? "雾" : code <= 67 ? "雨" : code <= 77 ? "雪" : code <= 82 ? "阵雨" : code <= 86 ? "阵雪" : "雷雨";
async function loadWeather() {
  $("weatherReload").disabled = true;
  try {
    const data = await api("/api/public/weather");
    const { temperature_2m: temperature, weather_code: code } = data.current || {};
    if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error();
    $("weatherTemp").textContent = `${Math.round(temperature)}°`;
    $("weatherDescription").textContent = `${WMO(code)} · 摄氏度`;
  } catch { $("weatherTemp").textContent = "—"; $("weatherDescription").textContent = "暂不可用，点右上角重试"; }
  finally { $("weatherReload").disabled = false; }
}
$("weatherReload").onclick = loadWeather;
async function loadQuote() {
  try {
    const quote = await api("/api/public/quote");
    if (typeof quote.hitokoto !== "string" || !quote.hitokoto) throw new Error();
    $("hitokoto").textContent = quote.hitokoto;
    $("hitokotoFrom").textContent = quote.from || "一言";
  } catch { $("hitokoto").textContent = "一言暂时没有连接上。"; $("hitokotoFrom").textContent = ""; }
}

let items = new Map(), afterId = null, loading = false, repos = [], language = "";
function renderRepositories() {
  const query = $("repoSearch").value.trim().toLowerCase();
  const visible = repos.filter(repo => (!language || repo.language === language) && `${repo.name} ${repo.description}`.toLowerCase().includes(query));
  const fragment = document.createDocumentFragment();
  for (const repo of visible) {
    const link = element("a", "repo");
    link.href = repo.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    const [owner, name] = repo.name.split("/");
    const heading = element("div", "repo-heading"), identity = element("div", "repo-identity");
    identity.append(element("span", "repo-owner", owner), element("span", "repo-name", name));
    const arrow = icon("arrow", true); arrow.classList.add("repo-arrow");
    heading.append(element("span", "repo-avatar", owner[0]), identity, arrow);
    const description = element("p", "repo-description", repo.description || "暂无项目简介");
    description.title = repo.description;
    const meta = element("div", "repo-meta"), dot = element("span", "lang-dot");
    dot.style.background = LANGUAGE_COLORS[repo.language] || "#74819c";
    const stars = element("span", "repo-stars");
    stars.append(icon("star", true), document.createTextNode(repo.stars.toLocaleString("en-US")));
    meta.append(dot, element("span", "", repo.language), stars, element("span", "repo-rank", `#${repo.rank}`));
    link.append(heading, description, meta); fragment.append(link);
  }
  $("repoGrid").replaceChildren(fragment);
  $("repoGrid").setAttribute("aria-busy", "false");
  $("projectMessage").hidden = visible.length > 0;
  $("projectMessage").textContent = repos.length ? "没有匹配的项目，试试其他关键词。" : "还没有公开的项目快照。";
  $("repoCount").textContent = repos.length ? `${visible.length} / ${repos.length} 个项目` : "GitHub Search API 数据快照";
}
function renderFilters() {
  const values = ["", ...new Set(repos.map(repo => repo.language))];
  if (!values.includes(language)) language = "";
  $("languageFilters").replaceChildren(...values.map(value => {
    const button = element("button", `filter${language === value ? " active" : ""}`, value || "全部");
    button.dataset.language = value;
    button.setAttribute("aria-pressed", String(language === value));
    return button;
  }));
}
$("languageFilters").onclick = event => {
  const button = event.target.closest("[data-language]");
  if (!button) return;
  language = button.dataset.language; renderFilters(); renderRepositories();
};
$("repoSearch").oninput = renderRepositories;
function renderNote(item) {
  const article = element("article", "note");
  article.append(element("h2", "", item.subject || "未命名笔记"), element("time", "", String(item.created_at || "").slice(0, 10)));
  const body = element("div", "note-content");
  for (const line of String(item.content || "").split("\n")) {
    const match = line.trim().match(REPO_LINE);
    if (match) {
      const link = element("a", "", line); link.href = `https://github.com/${match[1]}`; link.target = "_blank"; link.rel = "noopener noreferrer";
      body.append(link, document.createTextNode("\n"));
    } else body.append(document.createTextNode(line + "\n"));
  }
  article.append(body);
  return article;
}
function renderItems() {
  const entries = [...items.values()].sort((a, b) => b.id - a.id);
  const isTrending = item => Array.isArray(item.tags) && item.tags.includes("trending");
  const latest = entries.find(isTrending);
  repos = latest ? parseRepositories(latest.content).map((repo, index) => ({ ...repo, rank: index + 1 })) : [];
  const date = latest?.subject?.match(/\d{4}-\d{2}-\d{2}/)?.[0] || String(latest?.created_at || "").slice(0, 10);
  $("digestInfo").textContent = latest ? `${date} 快照 · 近 7 天新建 · 按 Star 排序（非实时榜单）` : "近 7 天新创建的项目，按 Star 排序。";
  renderFilters(); renderRepositories();
  const notes = entries.filter(item => !isTrending(item));
  $("feed").replaceChildren(...notes.map(renderNote));
  $("notesSection").hidden = !notes.length;
}
async function loadNotes(append = false) {
  if (loading) return;
  loading = true;
  $("projectsReload").disabled = $("more").disabled = true;
  $("feedStatus").textContent = "";
  try {
    const query = new URLSearchParams({ limit: "20" });
    if (append && afterId) query.set("after_id", afterId);
    const data = await api(`/api/public/memories?${query}`);
    if (!Array.isArray(data.items)) throw new Error("返回的笔记数据不完整");
    if (!append) items = new Map();
    for (const item of data.items) items.set(item.id, item);
    afterId = data.next_after_id;
    $("more").hidden = !afterId;
    renderItems();
  } catch (error) {
    if (!items.size) { $("projectMessage").hidden = false; $("projectMessage").textContent = "项目暂时没加载出来，点击右上角刷新重试。"; }
    else $("feedStatus").textContent = "读取失败，保留当前内容，请重试。";
  } finally {
    $("repoGrid").setAttribute("aria-busy", "false");
    $("projectsReload").disabled = $("more").disabled = false;
    loading = false;
  }
}
$("projectsReload").onclick = () => loadNotes();
$("more").onclick = () => loadNotes(true);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderDate(); renderRest(); } });
loadHolidays(); loadWeather(); loadQuote(); loadNotes(); initAuth();
