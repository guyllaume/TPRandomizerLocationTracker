import { describe, expect, it } from "vitest";
import { regions } from "../data/regions";
import type { TrackerSave } from "../types/tracker";
import { createTrackerSave, exportFilename, parseTrackerSave, validateTrackerSave } from "./importExport";

function validSave(): TrackerSave {
  return createTrackerSave({
    seedName: "Seed 473829",
    positions: {
      "kakariko-village": { x: 10, y: 20 },
      "lake-hylia": { x: 300, y: 400 },
    },
    connections: [
      {
        id: "connection-1",
        sourceRegionId: "kakariko-village",
        sourceEntranceId: "kakariko-graveyard",
        targetRegionId: "lake-hylia",
        targetEntranceId: "lake-spirit-cave",
        direction: "discovered",
        arrowMode: "forward",
      },
    ],
    settings: { showMinimap: true, defaultArrowMode: "forward" },
  });
}

describe("tracker save validation", () => {
  it("round-trips a valid save", () => {
    const original = validSave();
    const result = parseTrackerSave(JSON.stringify(original), regions);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save).toEqual(original);
  });

  it("loads older saves without an arrow mode as forward arrows", () => {
    const legacySave = validSave() as unknown as {
      connections: Array<Record<string, unknown>>;
    };
    delete legacySave.connections[0].arrowMode;

    const result = validateTrackerSave(legacySave, regions);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.connections[0].arrowMode).toBe("forward");
  });

  it("loads older saves without a default arrow setting as forward", () => {
    const legacySave = validSave() as unknown as {
      settings: Record<string, unknown>;
    };
    delete legacySave.settings.defaultArrowMode;

    const result = validateTrackerSave(legacySave, regions);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.save.settings.defaultArrowMode).toBe("forward");
  });

  it("rejects invalid JSON without throwing", () => {
    expect(parseTrackerSave("{bad json", regions)).toEqual({
      ok: false,
      error: "The selected file is not valid JSON.",
    });
  });

  it("rejects unknown entrance references", () => {
    const save = validSave();
    save.connections[0].targetEntranceId = "not-an-entrance";

    const result = validateTrackerSave(save, regions);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("unknown target entrance");
  });

  it("rejects the same relationship in reverse", () => {
    const save = validSave();
    save.connections.push({
      id: "connection-2",
      sourceRegionId: "lake-hylia",
      sourceEntranceId: "lake-spirit-cave",
      targetRegionId: "kakariko-village",
      targetEntranceId: "kakariko-graveyard",
      direction: "discovered",
      arrowMode: "reverse",
    });

    const result = validateTrackerSave(save, regions);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("duplicates another connection");
  });

  it("builds a safe export filename", () => {
    expect(exportFilename("  Seed 47 / Hero Mode!  ")).toBe(
      "tp-entrance-tracker-seed-47-hero-mode.json",
    );
  });
});
