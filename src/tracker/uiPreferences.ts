export type ThemePreference = "system" | "light" | "dark";

export interface UiPreferences {
  theme: ThemePreference;
  sidebarCollapsed: boolean;
  minimapLegendExpanded: boolean;
}

export const UI_PREFERENCES_STORAGE_KEY = "tp-entrance-tracker:ui-preferences";

export const DEFAULT_UI_PREFERENCES: UiPreferences = {
  theme: "system",
  sidebarCollapsed: false,
  minimapLegendExpanded: false,
};

export function parseUiPreferences(raw: string | null): UiPreferences {
  if (!raw) return { ...DEFAULT_UI_PREFERENCES };

  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const theme = value.theme === "light" || value.theme === "dark" || value.theme === "system"
      ? value.theme
      : DEFAULT_UI_PREFERENCES.theme;
    return {
      theme,
      sidebarCollapsed: typeof value.sidebarCollapsed === "boolean"
        ? value.sidebarCollapsed
        : DEFAULT_UI_PREFERENCES.sidebarCollapsed,
      minimapLegendExpanded: typeof value.minimapLegendExpanded === "boolean"
        ? value.minimapLegendExpanded
        : DEFAULT_UI_PREFERENCES.minimapLegendExpanded,
    };
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function readUiPreferences(): UiPreferences {
  try {
    return parseUiPreferences(window.localStorage.getItem(UI_PREFERENCES_STORAGE_KEY));
  } catch {
    return { ...DEFAULT_UI_PREFERENCES };
  }
}

export function writeUiPreferences(preferences: UiPreferences): void {
  try {
    window.localStorage.setItem(UI_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // UI preferences are optional; tracker state persistence reports its own failures.
  }
}

export function applyThemePreference(theme: ThemePreference, root: HTMLElement): void {
  if (theme === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.dataset.theme = theme;
  }
}
