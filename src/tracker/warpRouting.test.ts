import { describe, expect, it } from "vitest";
import { entranceDirectionsById } from "../data/locations";
import type { ArrowMode, EntranceDirection, TrackerConnection } from "../types/tracker";
import {
  buildLocationGraph,
  findReachableLocationIds,
  findShortestAccessibleWarpRoutes,
} from "./graph";
import { availableWarpDestinationIds } from "./startLocation";

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
  it("treats START as an immediately available warp even without a normal portal", () => {
    const available = availableWarpDestinationIds([], "start-without-warp");

    expect(routes([], "start-without-warp", available, available)).toEqual([{
      warpLocationId: "start-without-warp",
      distance: 0,
      path: ["start-without-warp"],
      edges: [],
    }]);
  });

  it("finds a two-transition route from the selection to one accessible warp", () => {
    const result = routes([
      connection("one", "selected", "a"),
      connection("two", "a", "warp"),
    ], "selected", ["warp"], ["warp"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      warpLocationId: "warp",
      distance: 2,
      path: ["selected", "a", "warp"],
    });
    expect(result[0].edges.map((edge) => edge.connectionId)).toEqual(["one", "two"]);
  });

  it("ignores a closer inaccessible red warp", () => {
    const result = routes([
      connection("red", "selected", "red-warp"),
      connection("green-one", "selected", "a"),
      connection("green-two", "a", "green-warp"),
    ], "selected", ["red-warp", "green-warp"], ["green-warp"]);

    expect(result.map((route) => route.path)).toEqual([["selected", "a", "green-warp"]]);
  });

  it("chooses the shortest of multiple accessible warps", () => {
    const result = routes([
      connection("s-a", "selected", "a"),
      connection("a-w1", "a", "warp-1"),
      connection("s-b", "selected", "b"),
      connection("b-c", "b", "c"),
      connection("c-w2", "c", "warp-2"),
    ], "selected", ["warp-1", "warp-2"], ["warp-1", "warp-2"]);

    expect(result.map((route) => route.warpLocationId)).toEqual(["warp-1"]);
    expect(result[0].distance).toBe(2);
  });

  it("returns all equal-length accessible warp routes in stable ID order", () => {
    const result = routes([
      connection("s-b", "selected", "b"),
      connection("b-z", "b", "warp-z"),
      connection("s-a", "selected", "a"),
      connection("a-a", "a", "warp-a"),
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
      connection("one", "selected", "a"),
      connection("two", "a", "green-warp"),
    ], "selected", ["selected", "green-warp"], ["green-warp"]);

    expect(result[0].path).toEqual(["selected", "a", "green-warp"]);
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
      connection("c-warp", "c", "warp"),
    ], "b", ["warp"], ["warp"]);

    expect(result[0]).toMatchObject({ distance: 2, path: ["b", "c", "warp"] });
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

  it("does not use a route whose entire connection chain points from the warp", () => {
    const result = routes([
      connection("warp-a", "warp", "a"),
      connection("a-selected", "a", "selected"),
    ], "selected", ["warp"], ["warp"]);

    expect(result).toEqual([]);
  });

  it("rejects a connected chain when one middle edge points the wrong way", () => {
    const result = routes([
      connection("warp-a", "warp", "a"),
      connection("b-a", "b", "a"),
      connection("b-selected", "b", "selected"),
    ], "selected", ["warp"], ["warp"]);

    expect(result).toEqual([]);
  });

  it("does not route Faron Woods to Lake Hylia through a Lake-to-Lanayru edge", () => {
    const result = routes([
      connection("faron-lanayru", "faron-woods", "lanayru-field"),
      connection("lake-lanayru", "lake-hylia", "lanayru-field"),
    ], "lake-hylia", ["faron-woods"], ["faron-woods"]);

    expect(result).toEqual([]);
  });

  it("rejects the Faron/Lanayru/Lake topology using the real entrance directions", () => {
    const connections: TrackerConnection[] = [{
      id: "faron-lanayru",
      sourceLocationId: "north-faron-woods",
      sourceEntranceId: "north-faron-woods--faron-woods",
      targetLocationId: "lanayru-field",
      targetEntranceId: "lanayru-field--west-castle-town-field",
      direction: "discovered",
      arrowMode: "forward",
    }, {
      id: "lake-lanayru",
      sourceLocationId: "lake-hylia",
      sourceEntranceId: "lake-hylia--gerudo-desert--out",
      targetLocationId: "lanayru-field",
      targetEntranceId: "lanayru-field--zora-s-domain-west-ledge",
      direction: "discovered",
      arrowMode: "forward",
    }];

    const result = findShortestAccessibleWarpRoutes(
      buildLocationGraph(connections, entranceDirectionsById),
      "lake-hylia",
      ["north-faron-woods"],
      new Set(["north-faron-woods"]),
    );

    expect(result).toEqual([]);
  });

  it("allows both traversal directions only for an explicitly bidirectional connection", () => {
    const graph = buildLocationGraph([
      connection("one-way", "a", "b", "forward"),
      connection("two-way", "b", "c", "bidirectional"),
    ]);

    expect(findReachableLocationIds(graph, ["b"]).has("a")).toBe(false);
    expect(findReachableLocationIds(graph, ["b"]).has("c")).toBe(true);
    expect(findReachableLocationIds(graph, ["c"]).has("b")).toBe(true);
  });

  it("chooses a longer playable route over a shorter reverse-only connection", () => {
    const result = routes([
      connection("warp-1-selected", "warp-1", "selected"),
      connection("selected-a", "selected", "a"),
      connection("a-b", "a", "b"),
      connection("b-warp-2", "b", "warp-2"),
    ], "selected", ["warp-1", "warp-2"], ["warp-1", "warp-2"]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      warpLocationId: "warp-2",
      distance: 3,
      path: ["selected", "a", "b", "warp-2"],
    });
  });

  it("follows only the playable branch through a mixed directed graph", () => {
    const result = routes([
      connection("selected-c", "selected", "c"),
      connection("c-a", "c", "a"),
      connection("a-warp", "a", "warp"),
      connection("selected-d", "selected", "d"),
      connection("b-d", "b", "d"),
      connection("b-a", "b", "a"),
    ], "selected", ["warp"], ["warp"]);

    expect(result[0]).toMatchObject({
      distance: 3,
      path: ["selected", "c", "a", "warp"],
    });
    expect(result[0].edges.map((edge) => [edge.fromLocationId, edge.toLocationId])).toEqual([
      ["selected", "c"],
      ["c", "a"],
      ["a", "warp"],
    ]);
  });

  it("combines connection arrow mode with dataset in/out constraints", () => {
    const forward = connection("forward", "a", "b", "forward");
    const reverse = connection("reverse", "c", "d", "reverse");
    const bidirectional = connection("two-way", "e", "f", "bidirectional");
    const oneWay = connection("one-way", "g", "h", "bidirectional");
    const directions = new Map<string, EntranceDirection>([
      [forward.sourceEntranceId, "both"],
      [forward.targetEntranceId, "both"],
      [reverse.sourceEntranceId, "both"],
      [reverse.targetEntranceId, "both"],
      [bidirectional.sourceEntranceId, "both"],
      [bidirectional.targetEntranceId, "both"],
      [oneWay.sourceEntranceId, "out"],
      [oneWay.targetEntranceId, "in"],
    ]);
    const graph = buildLocationGraph(
      [forward, reverse, bidirectional, oneWay],
      directions,
    );

    expect(findReachableLocationIds(graph, ["b"]).has("a")).toBe(false);
    expect(findReachableLocationIds(graph, ["d"]).has("c")).toBe(true);
    expect(findReachableLocationIds(graph, ["f"]).has("e")).toBe(true);
    expect(findReachableLocationIds(graph, ["h"]).has("g")).toBe(false);
  });
});
