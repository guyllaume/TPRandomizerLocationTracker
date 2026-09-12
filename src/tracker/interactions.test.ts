import { describe, expect, it } from "vitest";
import {
  applyLocationSelectionChanges,
  groupDragPositions,
  locationsMovedByDrag,
  positionsChanged,
  updateLocationSelection,
} from "./interactions";

describe("location selection interactions", () => {
  it("replaces selection on an ordinary click", () => {
    expect(updateLocationSelection(["a", "b"], "c", false)).toEqual(["c"]);
  });

  it("toggles a location on a modified click", () => {
    expect(updateLocationSelection(["a"], "b", true)).toEqual(["a", "b"]);
    expect(updateLocationSelection(["a", "b"], "a", true)).toEqual(["b"]);
  });

  it("applies the selection changes emitted while drawing a marquee", () => {
    expect(applyLocationSelectionChanges([], [
      { id: "a", selected: true },
      { id: "b", selected: true },
    ])).toEqual(["a", "b"]);

    expect(applyLocationSelectionChanges(["a", "b"], [
      { id: "a", selected: false },
      { id: "c", selected: true },
    ])).toEqual(["b", "c"]);
  });
});

describe("group dragging", () => {
  it("moves the complete selection only when the dragged location is selected", () => {
    const selection = ["a", "b"];
    expect(locationsMovedByDrag(selection, "a")).toEqual(["a", "b"]);
    expect(locationsMovedByDrag(selection, "c")).toEqual(["c"]);
    expect(selection).toEqual(["a", "b"]);
  });

  it("preserves relative positions for every moved location", () => {
    const before = {
      a: { x: 10, y: 20 },
      b: { x: 35, y: 60 },
      c: { x: 90, y: 100 },
    };
    const after = groupDragPositions(before, ["a", "b"], "a", { x: 25, y: 15 });

    expect(after).toEqual({
      a: { x: 25, y: 15 },
      b: { x: 50, y: 55 },
    });
    expect(after.b.x - after.a.x).toBe(before.b.x - before.a.x);
    expect(after.b.y - after.a.y).toBe(before.b.y - before.a.y);
    expect(positionsChanged(before, after, ["a", "b"])).toBe(true);
  });

  it("does not treat a drag returning to its start as a move", () => {
    const positions = { a: { x: 10, y: 20 } };
    expect(positionsChanged(positions, positions, ["a"])).toBe(false);
  });
});
