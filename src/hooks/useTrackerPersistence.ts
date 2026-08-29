import { useEffect } from "react";
import type { TrackerSave } from "../types/tracker";
import { createTrackerSave } from "../tracker/importExport";
import { writeStoredTracker } from "../tracker/persistence";

export function useTrackerPersistence(
  state: Pick<
    TrackerSave,
    "seedName" | "placedLocationIds" | "positions" | "connections" |
    "activatedWarpLocationIds" | "settings"
  >,
  onStorageError: (message: string) => void,
): void {
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const result = writeStoredTracker(createTrackerSave(state));
      if (!result.ok) onStorageError(result.error);
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [state, onStorageError]);
}
