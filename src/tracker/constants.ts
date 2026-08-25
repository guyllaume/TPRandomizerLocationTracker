import type { TrackerSettings } from "../types/tracker";

export const TRACKER_VERSION = "0.2.0";
export const TRACKER_SCHEMA_VERSION = 2 as const;
export const STORAGE_KEY = "tp-entrance-tracker:run:v2";
export const LEGACY_STORAGE_KEY = "tp-entrance-tracker:run:v1";

export const DEFAULT_SETTINGS: TrackerSettings = {
  showMinimap: true,
  defaultArrowMode: "forward",
  hidePlacedLocations: false,
};
