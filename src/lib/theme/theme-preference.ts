export type ThemePreference = "dark" | "light";
export const DEFAULT_THEME: ThemePreference = "dark";
export const THEME_STORAGE_KEY = "agencyos-theme";
export const parseThemePreference = (value: string | null): ThemePreference =>
  value === "light" ? "light" : DEFAULT_THEME;
export const toggleTheme = (current: ThemePreference): ThemePreference =>
  current === "dark" ? "light" : "dark";
