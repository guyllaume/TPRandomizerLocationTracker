import { describe, expect, it, vi } from "vitest";
import type { LocationFlowNode } from "../types/tracker";
import { bringLocationIntoView, selectLocationNode } from "./locationJump";

function node(id: string, selected = false): LocationFlowNode {
  return {
    id,
    type: "location",
    position: { x: 0, y: 0 },
    selected,
    data: {
      location: {
        id,
        name: id,
        locationKind: "overworld",
        primaryGroup: "Test",
        entrances: [],
      },
      connectedEntranceIds: [],
      accessible: false,
      warpRouteEntranceIds: [],
    },
  };
}

describe("location quick jump integration", () => {
  it("selects the requested existing node and clears the previous node selection", () => {
    const selected = selectLocationNode([node("first", true), node("second")], "second");
    expect(selected.map((item) => [item.id, item.selected])).toEqual([
      ["first", false],
      ["second", true],
    ]);
  });

  it("centers the stable node ID with a smooth single-card fit", async () => {
    const fitView = vi.fn().mockResolvedValue(true);
    await bringLocationIntoView({ fitView }, "lake-hylia");

    expect(fitView).toHaveBeenCalledWith({
      nodes: [{ id: "lake-hylia" }],
      padding: 0.45,
      maxZoom: 1,
      duration: 400,
    });
  });
});
