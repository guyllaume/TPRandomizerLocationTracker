import { describe, expect, it } from "vitest";
import { locationsById } from "../data/locations";
import type { TrackerConnection } from "../types/tracker";
import {
  buildEdges,
  buildNodes,
  edgeToConnection,
  positionsFromNodes,
  updateNodeConnectionData,
} from "./graph";

describe("location graph state", () => {
  it("starts with no nodes or edges for a fresh run", () => {
    expect(buildNodes([], {}, [])).toEqual([]);
    expect(buildEdges([])).toEqual([]);
  });

  it("builds only explicitly placed locations using stable dataset IDs", () => {
    const coro = locationsById.get("coro-s-house");
    expect(coro).toBeDefined();
    const nodes = buildNodes(coro ? [coro] : [], { "coro-s-house": { x: 12, y: 34 } }, []);

    expect(nodes).toHaveLength(1);
    expect(nodes[0].id).toBe("coro-s-house");
    expect(nodes[0].data.location.entrances.map((entrance) => entrance.id)).toEqual([
      "coro-s-house--lower",
      "coro-s-house--upper",
    ]);
    expect(positionsFromNodes(nodes)).toEqual({ "coro-s-house": { x: 12, y: 34 } });
  });

  it("round-trips a discovered connection through React Flow edges", () => {
    const connection: TrackerConnection = {
      id: "connection-1",
      sourceLocationId: "coro-s-house",
      sourceEntranceId: "coro-s-house--lower",
      targetLocationId: "link-s-house",
      targetEntranceId: "link-s-house--door",
      direction: "discovered",
      arrowMode: "forward",
    };
    const [edge] = buildEdges([connection]);
    expect(edgeToConnection(edge)).toEqual(connection);
    expect(edge.style?.stroke).toBe("var(--connection-default)");
  });

  it("applies and round-trips one explicitly selected connection color", () => {
    const connection: TrackerConnection = {
      id: "colored-connection",
      sourceLocationId: "coro-s-house",
      sourceEntranceId: "coro-s-house--lower",
      targetLocationId: "link-s-house",
      targetEntranceId: "link-s-house--door",
      direction: "discovered",
      arrowMode: "bidirectional",
      color: "orange",
    };
    const [edge] = buildEdges([connection]);

    expect(edge.style?.stroke).toBe("var(--connection-orange)");
    expect(edge.markerStart).toMatchObject({ color: "var(--connection-orange)" });
    expect(edge.markerEnd).toMatchObject({ color: "var(--connection-orange)" });
    expect(edgeToConnection(edge)).toEqual(connection);
  });

  it("retains every connection ID associated with one entrance", () => {
    const coro = locationsById.get("coro-s-house");
    const connections: TrackerConnection[] = [
      {
        id: "first",
        sourceLocationId: "coro-s-house",
        sourceEntranceId: "coro-s-house--lower",
        targetLocationId: "link-s-house",
        targetEntranceId: "link-s-house--door",
        direction: "discovered",
        arrowMode: "forward",
      },
      {
        id: "second",
        sourceLocationId: "coro-s-house",
        sourceEntranceId: "coro-s-house--lower",
        targetLocationId: "kakariko-village",
        targetEntranceId: "kakariko-village--eldin-field",
        direction: "discovered",
        arrowMode: "forward",
      },
    ];

    const [node] = buildNodes(coro ? [coro] : [], {}, connections);
    expect(node.data.connectionIdsByEntranceId["coro-s-house--lower"])
      .toEqual(["first", "second"]);
  });

  it("tells every card when a START location already exists", () => {
    const definitions = ["link-s-house", "ordon-spring"]
      .map((id) => locationsById.get(id))
      .filter((location) => location !== undefined);
    const nodes = updateNodeConnectionData(
      buildNodes(definitions, {}, []),
      [],
      new Set(),
      undefined,
      undefined,
      undefined,
      "ordon-spring",
    );

    expect(nodes.every((node) => node.data.hasStartLocation)).toBe(true);
    expect(nodes.find((node) => node.id === "ordon-spring")?.data.isStart).toBe(true);
    expect(nodes.find((node) => node.id === "link-s-house")?.data.isStart).toBe(false);
  });
});
