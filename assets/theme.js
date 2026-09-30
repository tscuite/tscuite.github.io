// Runs before the stylesheet so both pages paint in the correct theme.
(() => {
  let preference;
  try { preference = localStorage.getItem("desk-theme"); } catch { /* Storage is optional. */ }
  if (!["light", "dark"].includes(preference)) preference = null;

  function apply() {
    const theme = preference || "dark"; // 无手动偏好时默认夜间
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#17191c" : "#f6f5f1");
    const button = document.getElementById("themeToggle");
    if (!button) return;
    button.title = theme === "dark" ? "切换日间模式" : "切换夜间模式";
    button.setAttribute("aria-label", button.title);
    button.querySelector("use").setAttribute("href", theme === "dark" ? "#i-sun" : "#i-moon");
  }

  apply();
  document.addEventListener("DOMContentLoaded", () => {
    apply();
    document.getElementById("themeToggle").addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try { localStorage.setItem("desk-theme", preference); } catch { /* Keep the choice for this page. */ }
      apply();
    });
  }, { once: true });
})();
