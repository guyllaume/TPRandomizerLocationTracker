import { describe, expect, it } from "vitest";
import { locations } from "../data/locations";
import { createTrackerSave } from "./importExport";
import { readStoredTracker, writeStoredTracker } from "./persistence";

describe("tracker persistence", () => {
  it("returns an empty run when storage has no save", () => {
    const result = readStoredTracker(locations, { getItem: () => null });
    expect(result).toEqual({ save: null, storageAvailable: true });
  });

  it("handles corrupt stored data gracefully", () => {
    const result = readStoredTracker(locations, { getItem: () => "not-json" });
    expect(result.save).toBeNull();
    expect(result.storageAvailable).toBe(true);
    expect(result.error).toContain("could not be loaded");
  });

  it("reports unavailable storage reads", () => {
    const result = readStoredTracker(locations, {
      getItem: () => { throw new Error("blocked"); },
    });
    expect(result.storageAvailable).toBe(false);
    expect(result.error).toContain("Export Run");
  });

  it("reports unavailable storage writes", () => {
    const save = createTrackerSave({
      placedLocationIds: [],
      positions: {},
      connections: [],
      settings: {
        showMinimap: false,
        defaultArrowMode: "forward",
        hidePlacedLocations: false,
      },
    });
    const result = writeStoredTracker(save, {
      setItem: () => { throw new Error("quota exceeded"); },
    });
    expect(result.ok).toBe(false);
  });
});
