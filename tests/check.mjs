import assert from "node:assert/strict";
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

console.log("PASS: 菜单校验、仓库解析、节假日/调休边界、时区换算");
