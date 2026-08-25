import type { RegionDefinition, TrackerSave } from "../types/tracker";
import { STORAGE_KEY } from "./constants";
import { parseTrackerSave } from "./importExport";

export interface StorageReadResult {
  save: TrackerSave | null;
  storageAvailable: boolean;
  error?: string;
}

export function readStoredTracker(
  definitions: RegionDefinition[],
  storage: Pick<Storage, "getItem"> = localStorage,
): StorageReadResult {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { save: null, storageAvailable: true };

    const parsed = parseTrackerSave(raw, definitions);
    if (!parsed.ok) {
      return {
        save: null,
        storageAvailable: true,
        error: `Saved run could not be loaded: ${parsed.error}`,
      };
    }
    return { save: parsed.save, storageAvailable: true };
  } catch {
    return {
      save: null,
      storageAvailable: false,
      error: "Browser persistence is unavailable. Use Export Run to keep a backup.",
    };
  }
}

export function writeStoredTracker(
  save: TrackerSave,
  storage: Pick<Storage, "setItem"> = localStorage,
): { ok: true } | { ok: false; error: string } {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(save));
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Browser persistence is unavailable. Use Export Run to keep a backup.",
    };
  }
}

export function clearStoredTracker(
  storage: Pick<Storage, "removeItem"> = localStorage,
): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // Reset remains usable in memory when storage is unavailable.
  }
}
