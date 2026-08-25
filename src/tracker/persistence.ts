import type { LocationDefinition, TrackerSave } from "../types/tracker";
import { LEGACY_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { parseTrackerSave } from "./importExport";

export interface StorageReadResult {
  save: TrackerSave | null;
  storageAvailable: boolean;
  error?: string;
  notice?: string;
}

export function readStoredTracker(
  definitions: LocationDefinition[],
  storage: Pick<Storage, "getItem"> = localStorage,
): StorageReadResult {
  try {
    const current = storage.getItem(STORAGE_KEY);
    const raw = current ?? storage.getItem(LEGACY_STORAGE_KEY);
    if (raw === null) return { save: null, storageAvailable: true };

    const parsed = parseTrackerSave(raw, definitions);
    if (!parsed.ok) {
      return {
        save: null,
        storageAvailable: true,
        error: `Saved run could not be loaded: ${parsed.error}`,
      };
    }
    return {
      save: parsed.save,
      storageAvailable: true,
      notice: parsed.warnings.length > 0 ? parsed.warnings.join(" ") : undefined,
    };
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
    storage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Reset remains usable in memory when storage is unavailable.
  }
}
