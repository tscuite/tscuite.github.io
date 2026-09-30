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
  // 管理员才显示「更新热门快照」按钮
  $("trendingRefresh").hidden = !(me?.isAdmin);
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
  node.style.setProperty("--dx", `${Math.round(-46 + Math.random() * 92)}px`);
  node.style.setProperty("--rot", `${Math.round(-18 + Math.random() * 36)}deg`);
  node.style.fontSize = `${13 + Math.round(Math.random() * 7)}px`;
  node.style.color = Math.random() < 0.5 ? "var(--brand)" : "var(--accent)";
  $("foodBody").append(node);
  setTimeout(() => node.remove(), 1100);
}
$("reroll").onclick = () => {
  if (rolling) return;
  rolling = true;
  $("reroll").disabled = true;
  $("reroll").classList.add("rolling");
  $("reroll").querySelector("span").textContent = "选择中…";
  const name = $("foodName");
  const previous = name.textContent;
  name.classList.add("reeling");
  $("foodHint").textContent = "让我想想…";
  const finish = () => {
    name.classList.remove("reeling");
    const candidates = foods.filter(f => f !== previous);
    const pool = candidates.length ? candidates : foods;
    const dish = pool[Math.floor(Math.random() * pool.length)];
    name.textContent = dish;
    name.classList.add("landing");
    for (let n = 0; n < 3; n++) scatter(dish);
    setTimeout(() => name.classList.remove("landing"), 500);
    $("foodHint").textContent = "就吃这个，不纠结了。";
    $("reroll").classList.remove("rolling");
    $("reroll").querySelector("span").textContent = "不行，再选一次";
    $("reroll").disabled = false;
    rolling = false;
  };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
  // 老虎机式减速：先快后慢，越来越接近开奖
  let ticks = 0, delay = 55;
  const tick = () => {
    const word = foods[Math.floor(Math.random() * foods.length)];
    name.textContent = word;
    if (Math.random() < 0.75) scatter(word);
    if (++ticks >= 18) return finish();
    delay *= 1.1;
    setTimeout(tick, delay);
  };
  tick();
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
    pill.setAttribute("role", "img");
    pill.setAttribute("aria-label", pill.title);
    pill.append(element("span", "", n === 0 ? "今" : "日一二三四五六"[dayOfWeek(date)]), element("strong", "", date.slice(-2)));
    week.append(pill);
  }
  $("weekStrip").replaceChildren(week);
  const upcoming = Object.values(holidayYears).flat().filter(h => h.StartDate > today).sort((a, b) => a.StartDate.localeCompare(b.StartDate))[0];
  $("holidayHint").textContent = known
    ? (upcoming ? `${upcoming.StartDate.slice(5).replace("-", "/")} ${upcoming.Name} · 高亮为休息日` : "高亮为休息日，已排除调休补班")
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
    // 天气图标随天气码变化：晴/多云/阴/雨/雪/雷
    let icon = "sun";
    if (code === 2) icon = "cloud-sun";
    else if (code === 3 || code === 45 || code === 48) icon = "cloud";
    else if ([71, 73, 75, 77, 85, 86].includes(code)) icon = "snow";
    else if (code >= 95) icon = "thunder";
    else if (code >= 51 && code <= 82) icon = "rain";
    document.querySelector(".weather-sun use").setAttribute("href", "#i-" + icon);
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
  } catch { $("hitokoto").textContent = ""; $("hitokotoFrom").textContent = ""; }
}

let items = new Map(), afterId = null, loading = false, repos = [];
function renderRepositories() {
  const fragment = document.createDocumentFragment();
  for (const repo of repos) {
    const link = element("a", "repo");
    link.href = repo.url; link.target = "_blank"; link.rel = "noopener noreferrer";
    const [owner, name] = repo.name.split("/");
    link.title = `${repo.name}：${repo.description || "暂无描述"}`;
    const heading = element("div", "repo-heading"), identity = element("div", "repo-identity");
    identity.append(element("span", "repo-owner", `${owner} / `), element("span", "repo-name", name));
    heading.append(identity, element("span", "repo-desc-inline", repo.description || "暂无描述"));
    const meta = element("div", "repo-meta"), language = element("span", "repo-language"), dot = element("span", "lang-dot");
    dot.style.background = LANGUAGE_COLORS[repo.language] || "#74819c";
    language.append(dot, element("span", "", repo.language));
    const stars = element("span", "repo-stars");
    stars.setAttribute("role", "img");
    stars.setAttribute("aria-label", `${repo.stars.toLocaleString("en-US")} stars`);
    stars.append(icon("star", true), document.createTextNode(repo.stars.toLocaleString("en-US")));
    meta.append(language, stars);
    link.append(element("span", "repo-rank", String(repo.rank).padStart(2, "0")), heading, meta);
    fragment.append(link);
  }
  $("repoGrid").replaceChildren(fragment);
  $("repoGrid").setAttribute("aria-busy", "false");
  $("projectsTitle").textContent = repos.length ? `GitHub Top ${repos.length} Stars` : "GitHub Top Stars";
  $("projectMessage").hidden = repos.length > 0;
  $("projectMessage").textContent = "还没有公开的项目快照。";
  $("repoCount").textContent = repos.length ? `${repos.length} 个项目 · 每日更新` : "GitHub Search API 数据快照";
}
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
  $("digestInfo").textContent = latest ? `${date} 快照 · 近 7 天新建 · 按 Star 排序` : "近 7 天新创建的项目，按 Star 排序。";
  renderRepositories();
  const notes = entries.filter(item => !isTrending(item));
  $("feed").replaceChildren(...notes.map(renderNote));
  $("notesSection").hidden = !notes.length;
}
async function loadNotes(append = false) {
  if (loading) return;
  loading = true;
  $("projectsReload").disabled = $("more").disabled = true;
  $("feedStatus").textContent = "";
  $("repoGrid").setAttribute("aria-busy", "true");
  if (!append && !items.size) {
    $("projectMessage").hidden = true;
    // 骨架屏：避免首屏空荡荡
    $("repoGrid").innerHTML = Array.from({ length: 8 }, () => `
      <div class="skeleton-row">
        <div class="skeleton w40"></div>
        <div class="skeleton w80"></div>
        <div class="skeleton w60"></div>
      </div>`).join("");
  }
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
    if (!items.size) {
      $("repoGrid").replaceChildren();
      $("projectMessage").hidden = false;
      $("projectMessage").textContent = "项目暂时没加载出来，点击右上角刷新重试。";
    }
    else $("feedStatus").textContent = "读取失败，保留当前内容，请重试。";
  } finally {
    $("repoGrid").setAttribute("aria-busy", "false");
    $("projectsReload").disabled = $("more").disabled = false;
    loading = false;
  }
}
$("projectsReload").onclick = () => loadNotes();
// 管理员手动更新每日热门快照（生成在队列里，20 秒后自动重读）
$("trendingRefresh").onclick = async () => {
  $("trendingRefresh").disabled = true;
  try {
    await api("/api/config/trending/refresh", { method: "POST", body: JSON.stringify({}) });
    toast("已开始更新快照，约 20 秒后自动刷新");
    setTimeout(() => { if (!loading) loadNotes(); }, 20000);
  } catch (error) {
    toast(error.message);
  } finally {
    $("trendingRefresh").disabled = false;
  }
};
$("more").onclick = () => loadNotes(true);
document.addEventListener("visibilitychange", () => { if (!document.hidden) { renderDate(); renderRest(); } });
loadHolidays(); loadWeather(); loadQuote(); loadNotes(); initAuth();
