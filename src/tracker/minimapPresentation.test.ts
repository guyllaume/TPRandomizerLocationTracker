import { describe, expect, it } from "vitest";
import type { LocationKind } from "../types/tracker";
import {
  MINIMAP_LOCATION_KINDS,
  minimapLocationMarkers,
  minimapLocationKindPresentation,
} from "./minimapPresentation";

describe("minimap location presentation", () => {
  it("maps every canonical location kind to a labeled theme color", () => {
    const kinds: LocationKind[] = [
      "overworld",
      "interior",
      "cave",
      "grotto",
      "dungeon",
      "boss-room",
    ];

    expect(MINIMAP_LOCATION_KINDS.map((entry) => entry.kind).sort()).toEqual(kinds.sort());
    for (const kind of kinds) {
      const presentation = minimapLocationKindPresentation(kind);
      expect(presentation.label.length).toBeGreaterThan(0);
      expect(presentation.color).toContain(`--minimap-${kind}`);
    }
  });

  it("gives START priority over a redundant warp marker", () => {
    const availableWarps = new Set(["start", "lake"]);
    expect(minimapLocationMarkers("start", "start", availableWarps, true)).toEqual({
      isStart: true,
      warpState: null,
    });
    expect(minimapLocationMarkers("lake", "start", availableWarps, true)).toEqual({
      isStart: false,
      warpState: "active",
    });
  });

  it("distinguishes inactive warp locations from locations without a warp", () => {
    expect(minimapLocationMarkers("spring", null, new Set(), true)).toEqual({
      isStart: false,
      warpState: "inactive",
    });
    expect(minimapLocationMarkers("house", null, new Set(), false)).toEqual({
      isStart: false,
      warpState: null,
    });
  });
});
