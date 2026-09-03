import { describe, expect, it } from "vitest";
import { locations } from "../data/locations";
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
    const result = parseTrackerSave(JSON.stringify(original), locations);

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
    expect(save).not.toHaveProperty("trackerVersion");
  });

  it("loads a save from a later app release when its schema is still current", () => {
    const laterReleaseSave = { ...validSave(), appVersion: "0.2.0" };
    const result = validateTrackerSave(laterReleaseSave, locations);

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

    const result = validateTrackerSave(previous, locations);

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
    const result = validateTrackerSave(futureSave, locations);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("newer version of the application");
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

    const result = validateTrackerSave(olderSave, locations);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.save.connections[0].arrowMode).toBe("forward");
      expect(result.save.settings.defaultArrowMode).toBe("forward");
      expect(result.save.settings.hidePlacedLocations).toBe(false);
      expect(result.save.activatedWarpLocationIds).toEqual([]);
      expect(result.save.clearedLocationIds).toEqual([]);
    }
  });

  it("rejects invalid JSON without throwing", () => {
    expect(parseTrackerSave("{bad json", locations)).toEqual({
      ok: false,
      error: "The selected file is not valid JSON.",
    });
  });

  it("rejects unknown entrance references", () => {
    const save = validSave();
    save.connections[0].targetEntranceId = "not-an-entrance";

    const result = validateTrackerSave(save, locations);
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

    const result = validateTrackerSave(save, locations);
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

    const result = validateTrackerSave(save, locations);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicates another connection");
  });

  it("rejects activated portals that are not placed warp locations", () => {
    const unplaced = validSave();
    unplaced.activatedWarpLocationIds = ["lake-hylia"];
    const unplacedResult = validateTrackerSave(unplaced, locations);
    expect(unplacedResult.ok).toBe(false);
    if (!unplacedResult.ok) expect(unplacedResult.error).toContain("unplaced warp");

    const notAWarp = validSave();
    notAWarp.activatedWarpLocationIds = ["coro-s-house"];
    const notAWarpResult = validateTrackerSave(notAWarp, locations);
    expect(notAWarpResult.ok).toBe(false);
    if (!notAWarpResult.ok) expect(notAWarpResult.error).toContain("unknown warp");
  });

  it("rejects cleared locations that are unknown, unplaced, or duplicated", () => {
    const unplaced = validSave();
    unplaced.clearedLocationIds = ["lake-hylia"];
    const unplacedResult = validateTrackerSave(unplaced, locations);
    expect(unplacedResult.ok).toBe(false);
    if (!unplacedResult.ok) expect(unplacedResult.error).toContain("unknown or unplaced");

    const duplicated = validSave();
    duplicated.clearedLocationIds = ["coro-s-house", "coro-s-house"];
    const duplicatedResult = validateTrackerSave(duplicated, locations);
    expect(duplicatedResult.ok).toBe(false);
    if (!duplicatedResult.ok) expect(duplicatedResult.error).toContain("more than once");
  });

  it("builds a safe export filename", () => {
    expect(exportFilename("  Seed 47 / Hero Mode!  ")).toBe(
      "tp-entrance-tracker-seed-47-hero-mode.json",
    );
  });
});
