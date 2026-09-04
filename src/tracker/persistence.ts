import type { DatasetVersion, LocationDefinition, TrackerSave } from "../types/tracker";
import { IMMEDIATE_PREVIOUS_STORAGE_KEY, STORAGE_KEY } from "./constants";
import { parseTrackerSave } from "./importExport";

export interface StorageReadResult {
  save: TrackerSave | null;
  storageAvailable: boolean;
  persistenceAllowed: boolean;
  error?: string;
  notice?: string;
}

export function readStoredTracker(
  definitionsByDatasetVersion: Readonly<Record<DatasetVersion, LocationDefinition[]>>,
  storage: Pick<Storage, "getItem"> = localStorage,
): StorageReadResult {
  try {
    const raw = storage.getItem(STORAGE_KEY) ?? storage.getItem(IMMEDIATE_PREVIOUS_STORAGE_KEY);
    if (raw === null) {
      return { save: null, storageAvailable: true, persistenceAllowed: true };
    }

    const parsed = parseTrackerSave(raw, definitionsByDatasetVersion);
    if (!parsed.ok) {
      return {
        save: null,
        storageAvailable: true,
        persistenceAllowed: false,
        error: `Saved run could not be loaded: ${parsed.error} Autosave has been paused to protect the stored data.`,
      };
    }
    return {
      save: parsed.save,
      storageAvailable: true,
      persistenceAllowed: true,
      notice: parsed.warnings.length > 0 ? parsed.warnings.join(" ") : undefined,
    };
  } catch {
    return {
      save: null,
      storageAvailable: false,
      persistenceAllowed: false,
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
    storage.removeItem(IMMEDIATE_PREVIOUS_STORAGE_KEY);
  } catch {
    // Reset remains usable in memory when storage is unavailable.
  }
}
