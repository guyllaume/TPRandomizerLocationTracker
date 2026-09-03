import { describe, expect, it } from "vitest";
import { locations } from "../data/locations";
import {
  APP_VERSION,
  IMMEDIATE_PREVIOUS_APP_VERSION,
  IMMEDIATE_PREVIOUS_STORAGE_KEY,
  STORAGE_KEY,
} from "./constants";
import { createTrackerSave } from "./importExport";
import { readStoredTracker, writeStoredTracker } from "./persistence";

describe("tracker persistence", () => {
  it("returns an empty run when storage has no save", () => {
    const result = readStoredTracker(locations, { getItem: () => null });
    expect(result).toEqual({
      save: null,
      storageAvailable: true,
      persistenceAllowed: true,
    });
  });

  it("handles corrupt stored data gracefully", () => {
    const result = readStoredTracker(locations, { getItem: () => "not-json" });
    expect(result.save).toBeNull();
    expect(result.storageAvailable).toBe(true);
    expect(result.persistenceAllowed).toBe(false);
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

  it("persists and reloads cleared location state", () => {
    const save = createTrackerSave({
      placedLocationIds: ["coro-s-house"],
      clearedLocationIds: ["coro-s-house"],
      positions: { "coro-s-house": { x: 12, y: 34 } },
      connections: [],
      settings: {
        showMinimap: false,
        defaultArrowMode: "forward",
        hidePlacedLocations: false,
      },
    });
    let stored = "";

    expect(writeStoredTracker(save, { setItem: (_key, value) => { stored = value; } })).toEqual({
      ok: true,
    });
    const result = readStoredTracker(locations, { getItem: () => stored });
    expect(result.save?.clearedLocationIds).toEqual(["coro-s-house"]);
  });

  it("persists application and schema metadata", () => {
    const save = createTrackerSave({
      placedLocationIds: [],
      positions: {},
      connections: [],
      settings: {
        showMinimap: true,
        defaultArrowMode: "forward",
        hidePlacedLocations: false,
      },
    });
    let storedKey = "";
    let storedValue = "";

    expect(writeStoredTracker(save, {
      setItem: (key, value) => {
        storedKey = key;
        storedValue = value;
      },
    })).toEqual({ ok: true });

    expect(storedKey).toBe(STORAGE_KEY);
    expect(JSON.parse(storedValue)).toMatchObject({
      schemaVersion: 1,
      appVersion: APP_VERSION,
    });
  });

  it("loads the immediately previous stored run without mutating its original value", () => {
    const previous = {
      ...createTrackerSave({
        placedLocationIds: ["coro-s-house"],
        positions: { "coro-s-house": { x: 12, y: 34 } },
        connections: [],
        settings: {
          showMinimap: false,
          defaultArrowMode: "forward",
          hidePlacedLocations: false,
        },
      }),
      schemaVersion: 2,
      trackerVersion: IMMEDIATE_PREVIOUS_APP_VERSION,
    } as unknown as Record<string, unknown>;
    delete previous.appVersion;
    const original = JSON.stringify(previous);
    let mutationCalls = 0;
    const requestedKeys: string[] = [];
    const storage = {
      getItem: (key: string) => {
        requestedKeys.push(key);
        return key === IMMEDIATE_PREVIOUS_STORAGE_KEY ? original : null;
      },
      setItem: () => { mutationCalls += 1; },
      removeItem: () => { mutationCalls += 1; },
    };

    const result = readStoredTracker(locations, storage);

    expect(requestedKeys).toEqual([STORAGE_KEY, IMMEDIATE_PREVIOUS_STORAGE_KEY]);
    expect(result.save?.placedLocationIds).toEqual(["coro-s-house"]);
    expect(result.save?.schemaVersion).toBe(1);
    expect(result.persistenceAllowed).toBe(true);
    expect(mutationCalls).toBe(0);
  });

  it("does not permit autosave over an unsupported future schema", () => {
    const original = JSON.stringify({ ...createTrackerSave({
      placedLocationIds: [],
      positions: {},
      connections: [],
      settings: {
        showMinimap: true,
        defaultArrowMode: "forward",
        hidePlacedLocations: false,
      },
    }), schemaVersion: 2 });
    let mutationCalls = 0;
    const storage = {
      getItem: () => original,
      setItem: () => { mutationCalls += 1; },
      removeItem: () => { mutationCalls += 1; },
    };

    const result = readStoredTracker(locations, storage);

    expect(result.save).toBeNull();
    expect(result.persistenceAllowed).toBe(false);
    expect(result.error).toContain("newer version of the application");
    expect(mutationCalls).toBe(0);
  });
});
