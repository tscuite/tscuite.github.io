export const LANGUAGE_COLORS = { Python: "#3572a5", Rust: "#ba7747", TypeScript: "#3178c6", Go: "#008aab", "C++": "#d43770", HTML: "#d44c2e", JavaScript: "#b39700", Java: "#b07219", Shell: "#619f27" };
export const REPO_LINE = /^([A-Za-z0-9][A-Za-z0-9_.-]*\/[A-Za-z0-9][A-Za-z0-9_.-]*)\s*★\s*([\d,]+)\s*[・·]\s*(.+)$/;

// ponytail: supports the existing pasted digest format, use structured JSON if the publishing format changes.
export function parseRepositories(content) {
  const repos = [];
  for (const raw of String(content || "").split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(REPO_LINE);
    if (match) {
      repos.push({ name: match[1], stars: Number(match[2].replaceAll(",", "")), language: match[3], description: "", url: `https://github.com/${match[1]}` });
    } else if (line && repos.length && !/^(数据来源|统计窗口|来源)[：:]/.test(line)) {
      repos.at(-1).description += (repos.at(-1).description ? " " : "") + line;
    }
  }
  return repos;
}

export function normalizeFoods(text) {
  const foods = [...new Set(String(text).split(/\s+/).filter(Boolean))];
  if (!foods.length) throw new Error("至少留一个选项");
  if (foods.length > 200 || foods.some(food => food.length > 30)) throw new Error("最多 200 个选项，每项不超过 30 个字");
  return foods;
}

export function chinaDate(now = new Date()) {
  return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
}
export function dayNumber(iso) { return Date.parse(iso + "T00:00:00Z") / 86400000; }
export function addDays(iso, days) { return new Date((dayNumber(iso) + days) * 86400000).toISOString().slice(0, 10); }
export function dayOfWeek(iso) { return new Date(iso + "T00:00:00Z").getUTCDay(); }
export function restInfo(years, iso) {
  const list = Array.isArray(years[iso.slice(0, 4)]) ? years[iso.slice(0, 4)] : [];
  const known = list.length > 0;
  if (list.some(h => h.CompDays?.includes(iso))) return { rest: false, name: "调休上班", known };
  const holiday = list.find(h => h.StartDate <= iso && iso <= h.EndDate);
  if (holiday) return { rest: true, name: holiday.Name, known, end: holiday.EndDate };
  const rest = [0, 6].includes(dayOfWeek(iso));
  return { rest, name: rest ? "周末" : "工作日", known };
}
export function nextRest(years, today) {
  for (let days = 0; days <= 45; days++) {
    const date = addDays(today, days), info = restInfo(years, date);
    if (info.rest) return { ...info, date, days };
  }
  return null;
}
