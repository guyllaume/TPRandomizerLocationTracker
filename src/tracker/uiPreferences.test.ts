import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_PREFERENCES,
  parseUiPreferences,
} from "./uiPreferences";

describe("UI preferences", () => {
  it("defaults missing and malformed preferences to System with an expanded sidebar", () => {
    expect(parseUiPreferences(null)).toEqual(DEFAULT_UI_PREFERENCES);
    expect(parseUiPreferences("not json")).toEqual(DEFAULT_UI_PREFERENCES);
  });

  it("accepts supported preferences without treating unknown values as valid", () => {
    expect(parseUiPreferences(JSON.stringify({
      theme: "dark",
      sidebarCollapsed: true,
      minimapLegendExpanded: true,
    }))).toEqual({
      theme: "dark",
      sidebarCollapsed: true,
      minimapLegendExpanded: true,
    });

    expect(parseUiPreferences(JSON.stringify({ theme: "sepia", sidebarCollapsed: "yes" })))
      .toEqual(DEFAULT_UI_PREFERENCES);
  });
});
