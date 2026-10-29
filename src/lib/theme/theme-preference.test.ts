import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseThemePreference,
  toggleTheme,
} from "./theme-preference";

describe("AgencyOS theme preferences", () => {
  it("defaults to dark for new users and unrecognized stored values", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(parseThemePreference(null)).toBe("dark");
    expect(parseThemePreference("system")).toBe("dark");
    expect(parseThemePreference("")).toBe("dark");
  });

  it("restores an explicitly selected light theme", () => {
    expect(THEME_STORAGE_KEY).toBe("agencyos-theme");
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
  });

  it("switches between dark and light without losing the selected mode", () => {
    expect(toggleTheme("dark")).toBe("light");
    expect(toggleTheme("light")).toBe("dark");
  });
});
