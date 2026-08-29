import { describe, expect, it } from "vitest";
import type { ArrowMode, EntranceDirection, TrackerConnection } from "../types/tracker";
import {
  buildLocationGraph,
  findReachableLocationIds,
  findShortestAccessibleWarpRoutes,
} from "./graph";

function connection(
  id: string,
  sourceLocationId: string,
  targetLocationId: string,
  arrowMode: ArrowMode = "forward",
): TrackerConnection {
  return {
    id,
    sourceLocationId,
    sourceEntranceId: `${sourceLocationId}--${id}`,
    targetLocationId,
    targetEntranceId: `${targetLocationId}--${id}`,
    direction: "discovered",
    arrowMode,
  };
}

function routes(
  connections: TrackerConnection[],
  selectedLocationId: string,
  warpLocationIds: string[],
  accessibleLocationIds: string[],
) {
  return findShortestAccessibleWarpRoutes(
    buildLocationGraph(connections),
    selectedLocationId,
    warpLocationIds,
    new Set(accessibleLocationIds),
  );
}

describe("accessible warp routing", () => {
  it("finds a two-transition route from one accessible warp", () => {
    const result = routes([
      connection("one", "warp", "a"),
      connection("two", "a", "selected"),
    ], "selected", ["warp"], ["warp"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      warpLocationId: "warp",
      distance: 2,
      path: ["warp", "a", "selected"],
    });
    expect(result[0].edges.map((edge) => edge.connectionId)).toEqual(["one", "two"]);
  });

  it("ignores a closer inaccessible red warp", () => {
    const result = routes([
      connection("red", "red-warp", "selected"),
      connection("green-one", "green-warp", "a"),
      connection("green-two", "a", "selected"),
    ], "selected", ["red-warp", "green-warp"], ["green-warp"]);

    expect(result.map((route) => route.path)).toEqual([["green-warp", "a", "selected"]]);
  });

  it("chooses the shortest of multiple accessible warps", () => {
    const result = routes([
      connection("w1-a", "warp-1", "a"),
      connection("a-s", "a", "selected"),
      connection("w2-b", "warp-2", "b"),
      connection("b-c", "b", "c"),
      connection("c-s", "c", "selected"),
    ], "selected", ["warp-1", "warp-2"], ["warp-1", "warp-2"]);

    expect(result.map((route) => route.warpLocationId)).toEqual(["warp-1"]);
    expect(result[0].distance).toBe(2);
  });

  it("returns all equal-length accessible warp routes in stable ID order", () => {
    const result = routes([
      connection("z-b", "warp-z", "b"),
      connection("b-s", "b", "selected"),
      connection("a-a", "warp-a", "a"),
      connection("a-s", "a", "selected"),
    ], "selected", ["warp-z", "warp-a"], ["warp-z", "warp-a"]);

    expect(result.map((route) => [route.warpLocationId, route.distance])).toEqual([
      ["warp-a", 2],
      ["warp-z", 2],
    ]);
  });

  it("returns distance zero when the selected location is an accessible warp", () => {
    expect(routes([], "selected", ["selected"], ["selected"])).toEqual([{
      warpLocationId: "selected",
      distance: 0,
      path: ["selected"],
      edges: [],
    }]);
  });

  it("does not use the selected location's own inaccessible warp", () => {
    const result = routes([
      connection("one", "green-warp", "a"),
      connection("two", "a", "selected"),
    ], "selected", ["selected", "green-warp"], ["green-warp"]);

    expect(result[0].path).toEqual(["green-warp", "a", "selected"]);
  });

  it("returns no route when there is no accessible warp", () => {
    expect(routes([
      connection("one", "red-warp", "a"),
      connection("two", "a", "selected"),
    ], "selected", ["red-warp"], [])).toEqual([]);
  });

  it("returns no route for a disconnected accessible warp", () => {
    expect(routes([
      connection("one", "a", "selected"),
    ], "selected", ["green-warp"], ["green-warp"])).toEqual([]);
  });

  it("terminates on cycles and returns the shortest route", () => {
    const result = routes([
      connection("a-b", "a", "b"),
      connection("b-c", "b", "c"),
      connection("c-a", "c", "a"),
      connection("warp-c", "warp", "c"),
    ], "b", ["warp"], ["warp"]);

    expect(result[0]).toMatchObject({ distance: 3, path: ["warp", "c", "a", "b"] });
  });

  it("does not traverse an unresolved entrance", () => {
    expect(routes([], "selected", ["warp"], ["warp"])).toEqual([]);
  });

  it("respects directed and bidirectional connection modes", () => {
    const graph = buildLocationGraph([
      connection("forward", "start", "a"),
      connection("both", "a", "b", "bidirectional"),
      connection("reverse", "c", "b", "reverse"),
    ]);

    expect([...findReachableLocationIds(graph, ["start"])]).toEqual(["start", "a", "b", "c"]);
    expect(findReachableLocationIds(graph, ["c"]).has("b")).toBe(false);
    expect(findReachableLocationIds(graph, ["b"]).has("start")).toBe(false);
  });

  it("uses entrance directions instead of display arrows when dataset metadata is available", () => {
    const twoWay = connection("two-way", "a", "b", "forward");
    const oneWay = connection("one-way", "b", "c", "bidirectional");
    const directions = new Map<string, EntranceDirection>([
      [twoWay.sourceEntranceId, "both"],
      [twoWay.targetEntranceId, "both"],
      [oneWay.sourceEntranceId, "out"],
      [oneWay.targetEntranceId, "in"],
    ]);
    const graph = buildLocationGraph([twoWay, oneWay], directions);

    expect(findReachableLocationIds(graph, ["b"]).has("a")).toBe(true);
    expect(findReachableLocationIds(graph, ["c"]).has("b")).toBe(false);
  });
});
