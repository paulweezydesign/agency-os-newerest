"use client";

import { useEffect, useState } from "react";
import { DEFAULT_THEME, THEME_STORAGE_KEY, parseThemePreference, toggleTheme, type ThemePreference } from "@/lib/theme/theme-preference";

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemePreference>(DEFAULT_THEME);
  useEffect(() => {
    let selected = DEFAULT_THEME;
    try { selected = parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY)); } catch { /* Storage can be unavailable. */ }
    document.documentElement.classList.toggle("dark", selected === "dark");
    document.documentElement.style.colorScheme = selected;
    setTheme(selected);
  }, []);
  const onToggle = () => {
    const next = toggleTheme(theme);
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* Keep in-memory choice. */ }
  };
  return (
    <button type="button" onClick={onToggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={theme === "light"}
      className="fixed bottom-4 right-4 z-50 rounded-lg border border-pink-500 bg-neutral-950 px-4 py-3 text-base font-semibold text-white shadow-lg outline-offset-4 hover:bg-neutral-800 focus-visible:outline-4 focus-visible:outline-pink-500">
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
