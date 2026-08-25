import { describe, expect, it } from "vitest";
import { locationsById } from "../data/locations";
import type { TrackerConnection } from "../types/tracker";
import { buildEdges, buildNodes, edgeToConnection, positionsFromNodes } from "./graph";

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
  });
});
