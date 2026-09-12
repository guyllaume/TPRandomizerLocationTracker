import { describe, expect, it } from "vitest";
import type { TrackerConnection } from "../types/tracker";
import {
  connectionColorCss,
  connectionFocusState,
  focusedConnectionEntranceIds,
  isConnectionColor,
  withConnectionColor,
  withConnectionsArrowMode,
  withConnectionsColor,
} from "./connectionPresentation";

function connection(id: string, sourceEntranceId: string, targetEntranceId: string): TrackerConnection {
  return {
    id,
    sourceLocationId: `source-${id}`,
    sourceEntranceId,
    targetLocationId: `target-${id}`,
    targetEntranceId,
    direction: "discovered",
    arrowMode: "bidirectional",
  };
}

describe("connection colors", () => {
  it("uses the default token when no explicit color is stored", () => {
    expect(connectionColorCss()).toBe("var(--connection-default)");
  });

  it("changes only visual metadata without changing connection identity", () => {
    const original = connection("one", "source-door", "target-door");
    const untouched = connection("two", "other-source", "other-target");
    const updated = withConnectionColor(original, "violet");

    expect(updated).toEqual({ ...original, color: "violet" });
    expect(updated.id).toBe(original.id);
    expect(updated.sourceEntranceId).toBe(original.sourceEntranceId);
    expect(updated.targetEntranceId).toBe(original.targetEntranceId);
    expect(withConnectionColor(updated, undefined)).toEqual(original);
    expect([original, untouched].map((item) =>
      item.id === original.id ? withConnectionColor(item, "violet") : item
    )).toEqual([updated, untouched]);
  });

  it("accepts only palette color identifiers", () => {
    expect(isConnectionColor("orange")).toBe(true);
    expect(isConnectionColor("random-color")).toBe(false);
    expect(new Set([undefined, "blue", "violet", "orange", "rose"].map((color) =>
      connectionColorCss(color as "blue" | "violet" | "orange" | "rose" | undefined)
    )).size).toBe(5);
  });

  it("applies color and arrow changes to every connection in a selected batch", () => {
    const selected = [
      connection("one", "a", "b"),
      connection("two", "c", "d"),
    ];

    expect(withConnectionsColor(selected, "rose").map((item) => item.color))
      .toEqual(["rose", "rose"]);
    expect(withConnectionsArrowMode(selected, "reverse").map((item) => item.arrowMode))
      .toEqual(["reverse", "reverse"]);
    expect(withConnectionsColor(selected, "blue").map((item) => item.id))
      .toEqual(["one", "two"]);
  });
});

describe("connection focus presentation", () => {
  const connections = [
    connection("one", "a", "b"),
    connection("two", "c", "d"),
  ];

  it("focuses one line, dims the others, and identifies both endpoints", () => {
    const selectedLocationIds = ["source-one", "target-two"];
    expect(connectionFocusState("one", ["one"])).toBe("focused");
    expect(connectionFocusState("two", ["one"])).toBe("dimmed");
    expect(focusedConnectionEntranceIds(connections, ["one"])).toEqual(new Set(["a", "b"]));
    expect(selectedLocationIds).toEqual(["source-one", "target-two"]);
  });

  it("focuses every connection and endpoint associated with a shared entrance", () => {
    const sharedConnections = [
      connection("one", "shared", "b"),
      connection("two", "shared", "d"),
      connection("three", "e", "f"),
    ];

    expect(connectionFocusState("one", ["one", "two"])).toBe("focused");
    expect(connectionFocusState("two", ["one", "two"])).toBe("focused");
    expect(connectionFocusState("three", ["one", "two"])).toBe("dimmed");
    expect(focusedConnectionEntranceIds(sharedConnections, ["one", "two"]))
      .toEqual(new Set(["shared", "b", "d"]));
  });

  it("restores normal presentation when focus is cleared", () => {
    expect(connectionFocusState("one", [])).toBeUndefined();
    expect(focusedConnectionEntranceIds(connections, [])).toEqual(new Set());
  });
});
