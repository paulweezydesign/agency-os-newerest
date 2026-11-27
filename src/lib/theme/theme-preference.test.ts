import { describe, expect, it } from "vitest";
import { runInNewContext } from "node:vm";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEME_BOOTSTRAP_SCRIPT,
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

  it.each([null, "dark", "light", "invalid"])("applies stored %s before hydration", (stored) => {
    const classes = new Set(["dark", "unrelated"]);
    const style = { colorScheme: "" };
    runInNewContext(THEME_BOOTSTRAP_SCRIPT, {
      localStorage: { getItem: (key: string) => {
        expect(key).toBe(THEME_STORAGE_KEY);
        return stored;
      } },
      document: { documentElement: {
        style,
        classList: { toggle: (name: string, enabled: boolean) => enabled ? classes.add(name) : classes.delete(name) },
      } },
    });
    expect(classes.has("dark")).toBe(stored !== "light");
    expect(classes.has("unrelated")).toBe(true);
    expect(style.colorScheme).toBe(parseThemePreference(stored));
  });

  it("keeps dark mode when access to storage throws", () => {
    let dark = false;
    const style = { colorScheme: "" };
    runInNewContext(THEME_BOOTSTRAP_SCRIPT, {
      get localStorage() { throw new Error("Storage disabled"); },
      document: { documentElement: {
        style,
        classList: { toggle: (_name: string, enabled: boolean) => { dark = enabled; } },
      } },
    });
    expect(dark).toBe(true);
    expect(style.colorScheme).toBe("dark");
  });
});
