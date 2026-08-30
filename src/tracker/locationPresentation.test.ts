import { describe, expect, it } from "vitest";
import type { TrackerConnection } from "../types/tracker";
import {
  buildLocationGraph,
  buildNodes,
  findShortestAccessibleWarpRoutes,
} from "./graph";
import { locationsById } from "../data/locations";
import {
  deriveLocationPresentation,
  toggleClearedLocationId,
} from "./locationPresentation";

describe("cleared location presentation", () => {
  it("renders an uncleared location expanded by default", () => {
    const location = locationsById.get("coro-s-house");
    const nodes = buildNodes(location ? [location] : [], {}, []);

    expect(nodes[0].data.cleared).toBe(false);
    expect(nodes[0].data.presentation).toBe("expanded");
    expect(deriveLocationPresentation(false, undefined)).toBe("expanded");
    expect(deriveLocationPresentation(false, "dimmed")).toBe("expanded");
  });

  it("toggles cleared player state on and off", () => {
    const cleared = toggleClearedLocationId([], "grotto");
    expect(cleared).toEqual(["grotto"]);
    expect(toggleClearedLocationId(cleared, "grotto")).toEqual([]);
  });

  it("minimizes a cleared location when it is not relevant", () => {
    expect(deriveLocationPresentation(true, undefined)).toBe("minimized");
    expect(deriveLocationPresentation(true, "dimmed")).toBe("minimized");
  });

  it.each(["selected", "related", "warp-route", "warp-destination"] as const)(
    "temporarily expands a cleared location in the %s focus state",
    (focusState) => {
      expect(deriveLocationPresentation(true, focusState)).toBe("expanded");
    },
  );

  it("does not involve cleared state in directed warp traversal", () => {
    const connections: TrackerConnection[] = [
      {
        id: "selected-a",
        sourceLocationId: "selected",
        sourceEntranceId: "selected-out",
        targetLocationId: "a",
        targetEntranceId: "a-in",
        direction: "discovered",
        arrowMode: "forward",
      },
      {
        id: "a-cleared",
        sourceLocationId: "a",
        sourceEntranceId: "a-out",
        targetLocationId: "cleared",
        targetEntranceId: "cleared-in",
        direction: "discovered",
        arrowMode: "forward",
      },
      {
        id: "cleared-warp",
        sourceLocationId: "cleared",
        sourceEntranceId: "cleared-out",
        targetLocationId: "warp",
        targetEntranceId: "warp-in",
        direction: "discovered",
        arrowMode: "forward",
      },
    ];
    const clearedLocationIds = new Set(["cleared"]);
    const routes = findShortestAccessibleWarpRoutes(
      buildLocationGraph(connections),
      "selected",
      ["warp"],
      new Set(["warp"]),
    );

    expect(clearedLocationIds.has(routes[0].path[2])).toBe(true);
    expect(routes[0].path).toEqual(["selected", "a", "cleared", "warp"]);
  });
});
