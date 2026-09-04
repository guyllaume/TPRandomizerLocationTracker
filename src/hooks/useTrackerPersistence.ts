import { useEffect } from "react";
import type { TrackerSave } from "../types/tracker";
import { createTrackerSave } from "../tracker/importExport";
import { writeStoredTracker } from "../tracker/persistence";

export function useTrackerPersistence(
  state: Pick<
    TrackerSave,
    "seedName" | "placedLocationIds" | "positions" | "connections" |
    "activatedWarpLocationIds" | "startLocationId" | "clearedLocationIds" | "settings" |
    "datasetVersion"
  >,
  onStorageError: (message: string) => void,
  enabled = true,
): void {
  useEffect(() => {
    if (!enabled) return;

    const timeout = window.setTimeout(() => {
      const result = writeStoredTracker(createTrackerSave(state));
      if (!result.ok) onStorageError(result.error);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [state, onStorageError, enabled]);
}
