import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { parseRepositories, normalizeFoods, nextRest, restInfo, chinaDate } from "../assets/core.mjs";

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

// The same pre-paint theme script serves the desk and memory page.
const themeScript = readFileSync(new URL("../assets/theme.js", import.meta.url), "utf8");
function themePage({ saved = null, dark = false, blocked = false } = {}) {
  const state = { saved, icon: null, label: null, chrome: null };
  const listeners = {};
  const system = { matches: dark, addEventListener: (_, fn) => { listeners.system = fn; } };
  const button = {
    setAttribute: (_, value) => { state.label = value; },
    querySelector: () => ({ setAttribute: (_, value) => { state.icon = value; } }),
    addEventListener: (_, fn) => { listeners.click = fn; },
  };
  const document = {
    documentElement: { dataset: {} },
    getElementById: () => state.ready ? button : null,
    querySelector: () => ({ setAttribute: (_, value) => { state.chrome = value; } }),
    addEventListener: (_, fn) => { listeners.ready = fn; },
  };
  runInNewContext(themeScript, {
    document, matchMedia: () => system,
    localStorage: {
      getItem() { if (blocked) throw new Error("blocked"); return state.saved; },
      setItem(_, value) { if (blocked) throw new Error("blocked"); state.saved = value; },
    },
  });
  const firstPaint = document.documentElement.dataset.theme;
  state.ready = true;
  listeners.ready();
  return { state, firstPaint, theme: () => document.documentElement.dataset.theme, click: listeners.click,
    systemChange(value) { system.matches = value; listeners.system(); } };
}
const automatic = themePage();
assert.equal(automatic.firstPaint, "light");
assert.equal(automatic.state.icon, "#i-moon");
automatic.systemChange(true);
assert.equal(automatic.theme(), "dark");
assert.equal(automatic.state.label, "切换日间模式");
assert.equal(automatic.state.chrome, "#17191c");
automatic.click();
assert.equal(automatic.theme(), "light");
assert.equal(automatic.state.saved, "light");
automatic.systemChange(true);
assert.equal(automatic.theme(), "light", "Manual preference must win over system changes");
assert.equal(themePage({ saved: "dark" }).firstPaint, "dark");
assert.equal(themePage({ saved: "light", dark: true }).firstPaint, "light");
assert.equal(themePage({ saved: "invalid", dark: true }).firstPaint, "dark");
const blocked = themePage({ blocked: true, dark: true });
blocked.click();
assert.equal(blocked.theme(), "light", "Blocked storage must not break the toggle");
for (const page of ["index.html", "memory/index.html"]) {
  const html = readFileSync(new URL(`../${page}`, import.meta.url), "utf8");
  const bootstrap = html.indexOf('<script src="/assets/theme.js">');
  assert(bootstrap >= 0 && bootstrap < html.indexOf('rel="stylesheet"'), "Apply theme before CSS");
  assert(html.includes('id="i-moon"') && html.includes('id="themeToggle"'));
}
// 记忆页：有 token 时首屏隐藏登录卡（内联脚本 + 样式双重保证）
{
  const memoryHtml = readFileSync(new URL("../memory/index.html", import.meta.url), "utf8");
  const memoryCss = readFileSync(new URL("../assets/memory.css", import.meta.url), "utf8");
  assert(memoryHtml.includes("dataset.pending") && memoryHtml.includes("desk_session"));
  assert(memoryHtml.includes('id="authLoading"') && memoryHtml.includes("sessionToken"));
  assert(memoryCss.includes(":root[data-pending] #setup") && memoryCss.includes(":root[data-pending] #authLoading"));
}

// Small text and filled controls must remain readable in both palettes.
function luminance(hex) {
  const channels = hex.match(/[a-f\d]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + .05) / (low + .05);
}
const css = readFileSync(new URL("../assets/desk.css", import.meta.url), "utf8");
for (const selector of [":root", ":root[data-theme=dark]"]) {
  const block = css.slice(css.indexOf(selector)).split("}")[0];
  const colors = Object.fromEntries([...block.matchAll(/--([\w-]+):\s*(#[a-f\d]{6});/gi)].map(match => [match[1], match[2]]));
  for (const fg of ["ink", "muted", "faint", "brand"]) {
    for (const bg of ["bg", "paper", "soft", "wash", "meal"]) {
      assert(contrast(colors[fg], colors[bg]) >= 4.5, `${selector}: ${fg} on ${bg} needs 4.5:1 contrast`);
    }
  }
  assert(contrast(colors["on-accent"], colors.accent) >= 4.5);
}
console.log("PASS: 菜单、仓库、节假日、时区、主题切换/系统跟随/存储降级、明暗配色对比度");
