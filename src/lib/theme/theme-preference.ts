export type ThemePreference = "dark" | "light";
export const DEFAULT_THEME: ThemePreference = "dark";
export const THEME_STORAGE_KEY = "agencyos-theme";
export const parseThemePreference = (value: string | null): ThemePreference =>
  value === "light" ? "light" : DEFAULT_THEME;
export const toggleTheme = (current: ThemePreference): ThemePreference =>
  current === "dark" ? "light" : "dark";

// Runs synchronously in <head>, before any themed content can be painted.
// Only trusted constants are interpolated; storage values never become code.
export const THEME_BOOTSTRAP_SCRIPT = `(() => {
  let theme = ${JSON.stringify(DEFAULT_THEME)};
  try {
    if (localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) === "light") theme = "light";
  } catch { /* Storage can be unavailable. Keep the default. */ }
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
})();`;
