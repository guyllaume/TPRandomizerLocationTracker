import { describe, expect, it } from "vitest";
import { locationDefinitionsByDatasetVersion } from "../data/locationDatasets";
import type { TrackerSave } from "../types/tracker";
import { APP_VERSION, IMMEDIATE_PREVIOUS_APP_VERSION } from "./constants";
import { createTrackerSave, exportFilename, parseTrackerSave, validateTrackerSave } from "./importExport";

function validSave(): TrackerSave {
  return createTrackerSave({
    seedName: "Seed 473829",
    placedLocationIds: ["coro-s-house", "link-s-house", "kakariko-village"],
    positions: {
      "coro-s-house": { x: 10, y: 20 },
      "link-s-house": { x: 300, y: 400 },
      "kakariko-village": { x: 600, y: 100 },
    },
    connections: [{
      id: "connection-1",
      sourceLocationId: "coro-s-house",
      sourceEntranceId: "coro-s-house--lower",
      targetLocationId: "link-s-house",
      targetEntranceId: "link-s-house--door",
      direction: "discovered",
      arrowMode: "forward",
    }],
    activatedWarpLocationIds: ["kakariko-village"],
    clearedLocationIds: ["coro-s-house"],
    settings: {
      showMinimap: true,
      defaultArrowMode: "forward",
      hidePlacedLocations: false,
    },
  });
}

describe("tracker save validation", () => {
  it("round-trips placed locations, positions, connections, and settings", () => {
    const original = validSave();
    const result = parseTrackerSave(JSON.stringify(original), locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save).toEqual(original);
      expect(result.save).not.toHaveProperty("locations");
    }
  });

  it("writes independent application and schema version metadata", () => {
    const save = validSave();

    expect(save.schemaVersion).toBe(1);
    expect(save.appVersion).toBe(APP_VERSION);
    expect(save.datasetVersion).toBe("0.2");
    expect(save).not.toHaveProperty("trackerVersion");
  });

  it("loads a save from a later app release when its schema is still current", () => {
    const laterReleaseSave = { ...validSave(), appVersion: "0.2.0" };
    const result = validateTrackerSave(laterReleaseSave, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.appVersion).toBe("0.2.0");
  });

  it("migrates the immediately previous run format", () => {
    const previous = {
      ...validSave(),
      schemaVersion: 2,
      trackerVersion: IMMEDIATE_PREVIOUS_APP_VERSION,
    } as unknown as Record<string, unknown>;
    delete previous.appVersion;

    const result = validateTrackerSave(previous, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.schemaVersion).toBe(1);
      expect(result.save.appVersion).toBe(IMMEDIATE_PREVIOUS_APP_VERSION);
      expect(result.save.connections).toHaveLength(1);
      expect(result.warnings.join(" ")).toContain("immediately previous");
    }
  });

  it("rejects a newer schema with a safe compatibility message", () => {
    const futureSave = { ...validSave(), schemaVersion: 2 };
    const result = validateTrackerSave(futureSave, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("newer version of the application");
  });

  it("rejects an unsupported dataset version instead of interpreting it as current", () => {
    const unsupported = { ...validSave(), datasetVersion: "0.3" };
    const result = validateTrackerSave(unsupported, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("Unsupported tracker dataset: 0.3");
  });

  it("loads saves without optional arrow and palette settings with safe defaults", () => {
    const olderSave = validSave() as unknown as {
      connections: Array<Record<string, unknown>>;
      settings: Record<string, unknown>;
    };
    delete olderSave.connections[0].arrowMode;
    delete olderSave.settings.defaultArrowMode;
    delete olderSave.settings.hidePlacedLocations;
    delete (olderSave as Record<string, unknown>).activatedWarpLocationIds;
    delete (olderSave as Record<string, unknown>).clearedLocationIds;
    delete (olderSave as Record<string, unknown>).startLocationId;

    const result = validateTrackerSave(olderSave, locationDefinitionsByDatasetVersion);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.connections[0].arrowMode).toBe("forward");
      expect(result.save.settings.defaultArrowMode).toBe("bidirectional");
      expect(result.save.settings.hidePlacedLocations).toBe(false);
      expect(result.save.activatedWarpLocationIds).toEqual([]);
      expect(result.save.clearedLocationIds).toEqual([]);
      expect(result.save.startLocationId).toBeNull();
    }
  });

  it("classifies an unversioned v0.1 save as legacy and preserves its old connection", () => {
    const legacySave = {
      ...createTrackerSave({
        placedLocationIds: ["ordon-bridge", "south-faron-woods"],
        positions: {
          "ordon-bridge": { x: 10, y: 20 },
          "south-faron-woods": { x: 300, y: 20 },
        },
        connections: [{
          id: "legacy-ordon-connection",
          sourceLocationId: "ordon-bridge",
          sourceEntranceId: "ordon-bridge--south-faron-woods",
          targetLocationId: "south-faron-woods",
          targetEntranceId: "south-faron-woods--ordon-bridge",
          direction: "discovered",
          arrowMode: "forward",
        }],
        settings: {
          showMinimap: true,
          defaultArrowMode: "forward",
          hidePlacedLocations: false,
        },
      }),
      appVersion: "0.1.0",
    } as Record<string, unknown>;
    delete legacySave.datasetVersion;

    const result = validateTrackerSave(legacySave, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.datasetVersion).toBe("0.1");
      expect(result.save.placedLocationIds).toEqual(["ordon-bridge", "south-faron-woods"]);
      expect(result.save.connections).toEqual(legacySave.connections);
      expect(result.warnings.join(" ")).toContain("classified as legacy dataset v0.1");
    }
  });

  it("round-trips START without changing entrance connections", () => {
    const save = validSave();
    save.startLocationId = "coro-s-house";
    const connectionsBefore = structuredClone(save.connections);

    const result = validateTrackerSave(save, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.startLocationId).toBe("coro-s-house");
      expect(result.save.connections).toEqual(connectionsBefore);
    }
  });

  it("normalizes retired location parents while preserving their entrance connections", () => {
    const legacySave = {
      ...validSave(),
      startLocationId: "top-of-kakariko-watchtower",
      placedLocationIds: [
        "top-of-kakariko-watchtower",
        "kakariko-village",
        "kakariko-watchtower",
        "lake-hylia-bridge-grotto-ledge",
        "lake-hylia-bridge",
        "lake-hylia-bridge-bubble-grotto",
      ],
      clearedLocationIds: ["top-of-kakariko-watchtower"],
      activatedWarpLocationIds: [],
      positions: {
        "top-of-kakariko-watchtower": { x: 10, y: 20 },
        "kakariko-village": { x: 40, y: 50 },
        "kakariko-watchtower": { x: 300, y: 20 },
        "lake-hylia-bridge-grotto-ledge": { x: 10, y: 300 },
        "lake-hylia-bridge": { x: 40, y: 350 },
        "lake-hylia-bridge-bubble-grotto": { x: 300, y: 300 },
      },
      connections: [{
        id: "watchtower-connection",
        sourceLocationId: "top-of-kakariko-watchtower",
        sourceEntranceId: "top-of-kakariko-watchtower--kakariko-watchtower-upper-door",
        targetLocationId: "kakariko-watchtower",
        targetEntranceId: "kakariko-watchtower--upper-door",
        direction: "discovered",
        arrowMode: "forward",
      }, {
        id: "bubble-grotto-connection",
        sourceLocationId: "lake-hylia-bridge-grotto-ledge",
        sourceEntranceId: "lake-hylia-bridge-grotto-ledge--entrance",
        targetLocationId: "lake-hylia-bridge-bubble-grotto",
        targetEntranceId: "lake-hylia-bridge-bubble-grotto--entrance",
        direction: "discovered",
        arrowMode: "forward",
      }],
    };

    const result = validateTrackerSave(legacySave, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.placedLocationIds).toEqual([
        "kakariko-village",
        "kakariko-watchtower",
        "lake-hylia-bridge",
        "lake-hylia-bridge-bubble-grotto",
      ]);
      expect(result.save.positions).toMatchObject({
        "kakariko-village": { x: 40, y: 50 },
        "lake-hylia-bridge": { x: 40, y: 350 },
      });
      expect(result.save.clearedLocationIds).toEqual(["kakariko-village"]);
      expect(result.save.startLocationId).toBe("kakariko-village");
      expect(result.save.connections.map((connection) => [
        connection.sourceLocationId,
        connection.sourceEntranceId,
      ])).toEqual([
        [
          "kakariko-village",
          "top-of-kakariko-watchtower--kakariko-watchtower-upper-door",
        ],
        ["lake-hylia-bridge", "lake-hylia-bridge-grotto-ledge--entrance"],
      ]);
      expect(result.warnings.join(" ")).toContain("Retired location references normalized");
    }
  });

  it("normalizes the Ordon and Eldin regrouping and drops only obsolete entrance connections", () => {
    const legacySave = {
      ...validSave(),
      startLocationId: "ordon-bridge",
      placedLocationIds: [
        "ordon-bridge",
        "south-faron-woods",
        "ordon-spring",
        "eldin-field-grotto-platform",
        "eldin-field",
        "eldin-field-stalfos-grotto",
        "coro-s-house",
        "link-s-house",
      ],
      clearedLocationIds: ["eldin-field-grotto-platform"],
      activatedWarpLocationIds: [],
      positions: {
        "ordon-bridge": { x: 10, y: 20 },
        "south-faron-woods": { x: 30, y: 40 },
        "ordon-spring": { x: 50, y: 60 },
        "eldin-field-grotto-platform": { x: 70, y: 80 },
        "eldin-field": { x: 90, y: 100 },
        "eldin-field-stalfos-grotto": { x: 110, y: 120 },
        "coro-s-house": { x: 130, y: 140 },
        "link-s-house": { x: 150, y: 160 },
      },
      connections: [{
        id: "ordon-preserved",
        sourceLocationId: "ordon-bridge",
        sourceEntranceId: "ordon-bridge--ordon-spring",
        targetLocationId: "coro-s-house",
        targetEntranceId: "coro-s-house--lower",
        direction: "discovered",
        arrowMode: "forward",
      }, {
        id: "eldin-preserved",
        sourceLocationId: "eldin-field-grotto-platform",
        sourceEntranceId: "eldin-field-grotto-platform--entrance",
        targetLocationId: "eldin-field-stalfos-grotto",
        targetEntranceId: "eldin-field-stalfos-grotto--entrance",
        direction: "discovered",
        arrowMode: "forward",
      }, {
        id: "obsolete-south-faron",
        sourceLocationId: "south-faron-woods",
        sourceEntranceId: "south-faron-woods--behind-gate",
        targetLocationId: "link-s-house",
        targetEntranceId: "link-s-house--door",
        direction: "discovered",
        arrowMode: "forward",
      }],
    };

    const result = validateTrackerSave(legacySave, locationDefinitionsByDatasetVersion);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.startLocationId).toBe("south-faron-woods");
      expect(result.save.clearedLocationIds).toEqual(["eldin-field"]);
      expect(result.save.positions).toMatchObject({
        "south-faron-woods": { x: 30, y: 40 },
        "eldin-field": { x: 90, y: 100 },
      });
      expect(result.save.connections.map((connection) => [
        connection.id,
        connection.sourceLocationId,
        connection.sourceEntranceId,
      ])).toEqual([
        ["ordon-preserved", "south-faron-woods", "ordon-bridge--ordon-spring"],
        ["eldin-preserved", "eldin-field", "eldin-field-grotto-platform--entrance"],
      ]);
      expect(result.warnings.join(" ")).toContain("ordon-bridge → south-faron-woods");
      expect(result.warnings.join(" ")).toContain("1 connection using obsolete entrance handles removed");
    }
  });

  it("rejects invalid JSON without throwing", () => {
    expect(parseTrackerSave("{bad json", locationDefinitionsByDatasetVersion)).toEqual({
      ok: false,
      error: "The selected file is not valid JSON.",
    });
  });

  it("rejects unknown entrance references", () => {
    const save = validSave();
    save.connections[0].targetEntranceId = "not-an-entrance";

    const result = validateTrackerSave(save, locationDefinitionsByDatasetVersion);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown target entrance");
  });

  it("rejects connections that violate one-way handle direction", () => {
    const save = validSave();
    save.placedLocationIds = ["sacred-grove-past", "coro-s-house"];
    save.positions = {
      "sacred-grove-past": { x: 0, y: 0 },
      "coro-s-house": { x: 300, y: 0 },
    };
    save.activatedWarpLocationIds = [];
    save.connections[0] = {
      id: "bad-direction",
      sourceLocationId: "sacred-grove-past",
      sourceEntranceId: "sacred-grove-past--warp-in-after-boss--in",
      targetLocationId: "coro-s-house",
      targetEntranceId: "coro-s-house--lower",
      direction: "discovered",
      arrowMode: "forward",
    };

    const result = validateTrackerSave(save, locationDefinitionsByDatasetVersion);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("arrival-only");
  });

  it("rejects the same relationship in reverse", () => {
    const save = validSave();
    save.connections.push({
      id: "connection-2",
      sourceLocationId: "link-s-house",
      sourceEntranceId: "link-s-house--door",
      targetLocationId: "coro-s-house",
      targetEntranceId: "coro-s-house--lower",
      direction: "discovered",
      arrowMode: "reverse",
    });

    const result = validateTrackerSave(save, locationDefinitionsByDatasetVersion);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicates another connection");
  });

  it("rejects activated portals that are not placed warp locations", () => {
    const unplaced = validSave();
    unplaced.activatedWarpLocationIds = ["lake-hylia"];
    const unplacedResult = validateTrackerSave(unplaced, locationDefinitionsByDatasetVersion);
    expect(unplacedResult.ok).toBe(false);
    if (!unplacedResult.ok) expect(unplacedResult.error).toContain("unplaced warp");

    const notAWarp = validSave();
    notAWarp.activatedWarpLocationIds = ["coro-s-house"];
    const notAWarpResult = validateTrackerSave(notAWarp, locationDefinitionsByDatasetVersion);
    expect(notAWarpResult.ok).toBe(false);
    if (!notAWarpResult.ok) expect(notAWarpResult.error).toContain("unknown warp");
  });

  it("rejects cleared locations that are unknown, unplaced, or duplicated", () => {
    const unplaced = validSave();
    unplaced.clearedLocationIds = ["lake-hylia"];
    const unplacedResult = validateTrackerSave(unplaced, locationDefinitionsByDatasetVersion);
    expect(unplacedResult.ok).toBe(false);
    if (!unplacedResult.ok) expect(unplacedResult.error).toContain("unknown or unplaced");

    const duplicated = validSave();
    duplicated.clearedLocationIds = ["coro-s-house", "coro-s-house"];
    const duplicatedResult = validateTrackerSave(duplicated, locationDefinitionsByDatasetVersion);
    expect(duplicatedResult.ok).toBe(false);
    if (!duplicatedResult.ok) expect(duplicatedResult.error).toContain("more than once");
  });

  it("builds a safe export filename", () => {
    expect(exportFilename("  Seed 47 / Hero Mode!  ")).toBe(
      "tp-entrance-tracker-seed-47-hero-mode.json",
    );
  });
});
