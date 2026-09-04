import type { TrackerSettings } from "../types/tracker";
import packageMetadata from "../../package.json";

export const APP_VERSION = packageMetadata.version;
export const TRACKER_SCHEMA_VERSION = 1 as const;
export const STORAGE_KEY = "tp-entrance-tracker:run";
export const IMMEDIATE_PREVIOUS_STORAGE_KEY = "tp-entrance-tracker:run:v2";
export const IMMEDIATE_PREVIOUS_APP_VERSION = "0.2.0";

export const DEFAULT_SETTINGS: TrackerSettings = {
  showMinimap: true,
  defaultArrowMode: "bidirectional",
  hidePlacedLocations: false,
};
