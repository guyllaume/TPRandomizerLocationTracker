import type {
  ArrowMode,
  EntranceDefinition,
  LocationDefinition,
  TrackerConnection,
  TrackerSave,
} from "../types/tracker";
import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  IMMEDIATE_PREVIOUS_APP_VERSION,
  TRACKER_SCHEMA_VERSION,
} from "./constants";
import { endpointsKey } from "./graph";

export const MAX_TRACKER_IMPORT_BYTES = 5 * 1024 * 1024;

export type ValidationResult =
  | { ok: true; save: TrackerSave; warnings: string[] }
  | { ok: false; error: string };

type NormalizationResult =
  | { ok: true; value: Record<string, unknown>; warnings: string[] }
  | { ok: false; error: string };

type EntranceIndex = Map<string, Map<string, EntranceDefinition>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isArrowMode(value: unknown): value is ArrowMode {
  return ["forward", "reverse", "bidirectional"].includes(value as string);
}

export function normalizePersistedState(value: unknown): NormalizationResult {
  if (!isRecord(value)) {
    return { ok: false, error: "The file does not contain a tracker save." };
  }

  if (
    value.schemaVersion === 2 &&
    value.appVersion === undefined &&
    value.trackerVersion === IMMEDIATE_PREVIOUS_APP_VERSION
  ) {
    return {
      ok: true,
      value: {
        ...value,
        schemaVersion: TRACKER_SCHEMA_VERSION,
        appVersion: value.trackerVersion,
      },
      warnings: ["Run from the immediately previous tracker format migrated to schema v1."],
    };
  }

  if (typeof value.schemaVersion === "number" && value.schemaVersion > TRACKER_SCHEMA_VERSION) {
    return {
      ok: false,
      error: "This tracker was created with a newer version of the application and cannot be loaded safely by this version.",
    };
  }
  if (value.schemaVersion !== TRACKER_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported save schema: ${String(value.schemaVersion)}.` };
  }

  return { ok: true, value, warnings: [] };
}

function entranceIndex(definitions: LocationDefinition[]): EntranceIndex {
  return new Map(
    definitions.map((location) => [
      location.id,
      new Map(location.entrances.map((entrance) => [entrance.id, entrance])),
    ]),
  );
}

function validateConnection(
  value: unknown,
  validEntrances: EntranceIndex,
  index: number,
): { ok: true; connection: TrackerConnection } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: `Connection ${index + 1} is not an object.` };
  }

  const fields = [
    "id",
    "sourceLocationId",
    "sourceEntranceId",
    "targetLocationId",
    "targetEntranceId",
  ] as const;
  for (const field of fields) {
    if (!isNonEmptyString(value[field])) {
      return { ok: false, error: `Connection ${index + 1} has an invalid ${field}.` };
    }
  }

  const sourceLocationId = value.sourceLocationId as string;
  const sourceEntranceId = value.sourceEntranceId as string;
  const targetLocationId = value.targetLocationId as string;
  const targetEntranceId = value.targetEntranceId as string;
  const sourceEntrance = validEntrances.get(sourceLocationId)?.get(sourceEntranceId);
  const targetEntrance = validEntrances.get(targetLocationId)?.get(targetEntranceId);

  if (!sourceEntrance) {
    return { ok: false, error: `Connection ${index + 1} has an unknown source entrance.` };
  }
  if (!targetEntrance) {
    return { ok: false, error: `Connection ${index + 1} has an unknown target entrance.` };
  }
  if (sourceEntrance.direction === "in") {
    return { ok: false, error: `Connection ${index + 1} starts at an arrival-only entrance.` };
  }
  if (targetEntrance.direction === "out") {
    return { ok: false, error: `Connection ${index + 1} ends at an outgoing-only entrance.` };
  }
  if (sourceLocationId === targetLocationId && sourceEntranceId === targetEntranceId) {
    return { ok: false, error: `Connection ${index + 1} connects an entrance to itself.` };
  }
  if (value.direction !== "discovered") {
    return { ok: false, error: `Connection ${index + 1} has an unsupported direction.` };
  }
  const arrowMode = value.arrowMode ?? "forward";
  if (!isArrowMode(arrowMode)) {
    return { ok: false, error: `Connection ${index + 1} has an unsupported arrow mode.` };
  }
  if (
    (sourceEntrance.direction !== "both" || targetEntrance.direction !== "both") &&
    arrowMode !== "forward"
  ) {
    return { ok: false, error: `Connection ${index + 1} reverses a one-way entrance.` };
  }

  return {
    ok: true,
    connection: {
      id: value.id as string,
      sourceLocationId,
      sourceEntranceId,
      targetLocationId,
      targetEntranceId,
      direction: "discovered",
      arrowMode,
    },
  };
}

function validateCurrentSave(
  value: Record<string, unknown>,
  definitions: LocationDefinition[],
  warnings: string[],
): ValidationResult {
  if (!isNonEmptyString(value.appVersion)) {
    return { ok: false, error: "The save is missing its application version." };
  }
  if (!isNonEmptyString(value.savedAt) || Number.isNaN(Date.parse(value.savedAt))) {
    return { ok: false, error: "The save has an invalid timestamp." };
  }
  if (value.seedName !== undefined && typeof value.seedName !== "string") {
    return { ok: false, error: "The save has an invalid seed name." };
  }
  if (!Array.isArray(value.placedLocationIds)) {
    return { ok: false, error: "The save has an invalid placed-location list." };
  }
  if (!isRecord(value.positions)) {
    return { ok: false, error: "The save has invalid node positions." };
  }
  if (!Array.isArray(value.connections)) {
    return { ok: false, error: "The save has an invalid connection list." };
  }
  if (!isRecord(value.settings) || typeof value.settings.showMinimap !== "boolean") {
    return { ok: false, error: "The save has invalid tracker settings." };
  }

  const defaultArrowMode = value.settings.defaultArrowMode ?? "forward";
  if (!isArrowMode(defaultArrowMode)) {
    return { ok: false, error: "The save has an invalid default arrow mode." };
  }
  const hidePlacedLocations = value.settings.hidePlacedLocations ?? false;
  if (typeof hidePlacedLocations !== "boolean") {
    return { ok: false, error: "The save has an invalid palette setting." };
  }

  const locationIds = new Set(definitions.map((location) => location.id));
  const warpLocationIds = new Set(
    definitions.filter((location) => location.hasWarp).map((location) => location.id),
  );
  const placedLocationIds: string[] = [];
  const placedSet = new Set<string>();
  for (const locationId of value.placedLocationIds) {
    if (!isNonEmptyString(locationId) || !locationIds.has(locationId)) {
      return { ok: false, error: `The save references an unknown location: ${String(locationId)}.` };
    }
    if (placedSet.has(locationId)) {
      return { ok: false, error: `The save places ${locationId} more than once.` };
    }
    placedSet.add(locationId);
    placedLocationIds.push(locationId);
  }

  const rawActivatedWarpLocationIds = value.activatedWarpLocationIds ?? [];
  if (!Array.isArray(rawActivatedWarpLocationIds)) {
    return { ok: false, error: "The save has an invalid activated-warp list." };
  }
  const activatedWarpLocationIds: string[] = [];
  const activatedWarpSet = new Set<string>();
  for (const locationId of rawActivatedWarpLocationIds) {
    if (!isNonEmptyString(locationId) || !warpLocationIds.has(locationId)) {
      return { ok: false, error: `The save activates an unknown warp: ${String(locationId)}.` };
    }
    if (!placedSet.has(locationId)) {
      return { ok: false, error: `The save activates an unplaced warp: ${locationId}.` };
    }
    if (activatedWarpSet.has(locationId)) {
      return { ok: false, error: `The save activates ${locationId} more than once.` };
    }
    activatedWarpSet.add(locationId);
    activatedWarpLocationIds.push(locationId);
  }

  const rawClearedLocationIds = value.clearedLocationIds ?? [];
  if (!Array.isArray(rawClearedLocationIds)) {
    return { ok: false, error: "The save has an invalid cleared-location list." };
  }
  const clearedLocationIds: string[] = [];
  const clearedLocationSet = new Set<string>();
  for (const locationId of rawClearedLocationIds) {
    if (!isNonEmptyString(locationId) || !placedSet.has(locationId)) {
      return {
        ok: false,
        error: `The save clears an unknown or unplaced location: ${String(locationId)}.`,
      };
    }
    if (clearedLocationSet.has(locationId)) {
      return { ok: false, error: `The save clears ${locationId} more than once.` };
    }
    clearedLocationSet.add(locationId);
    clearedLocationIds.push(locationId);
  }

  const positions: TrackerSave["positions"] = {};
  for (const [locationId, position] of Object.entries(value.positions)) {
    if (!placedSet.has(locationId)) {
      return { ok: false, error: `The save has a position for an unplaced location: ${locationId}.` };
    }
    if (
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y)
    ) {
      return { ok: false, error: `The position for ${locationId} is invalid.` };
    }
    positions[locationId] = { x: position.x, y: position.y };
  }

  const validEntrances = entranceIndex(definitions);
  const connections: TrackerConnection[] = [];
  const ids = new Set<string>();
  const endpointPairs = new Set<string>();
  for (const [index, candidate] of value.connections.entries()) {
    const result = validateConnection(candidate, validEntrances, index);
    if (!result.ok) return result;
    if (
      !placedSet.has(result.connection.sourceLocationId) ||
      !placedSet.has(result.connection.targetLocationId)
    ) {
      return { ok: false, error: `Connection ${index + 1} references an unplaced location.` };
    }
    if (ids.has(result.connection.id)) {
      return { ok: false, error: `Duplicate connection ID: ${result.connection.id}.` };
    }
    const pair = endpointsKey(result.connection);
    if (endpointPairs.has(pair)) {
      return { ok: false, error: `Connection ${index + 1} duplicates another connection.` };
    }
    ids.add(result.connection.id);
    endpointPairs.add(pair);
    connections.push(result.connection);
  }

  return {
    ok: true,
    warnings,
    save: {
      schemaVersion: TRACKER_SCHEMA_VERSION,
      appVersion: value.appVersion,
      seedName: value.seedName as string | undefined,
      savedAt: value.savedAt,
      placedLocationIds,
      clearedLocationIds,
      positions,
      connections,
      activatedWarpLocationIds,
      settings: {
        showMinimap: value.settings.showMinimap,
        defaultArrowMode,
        hidePlacedLocations,
      },
    },
  };
}

export function validateTrackerSave(
  value: unknown,
  definitions: LocationDefinition[],
): ValidationResult {
  const normalized = normalizePersistedState(value);
  if (!normalized.ok) return normalized;

  return validateCurrentSave(normalized.value, definitions, normalized.warnings);
}

export function parseTrackerSave(
  json: string,
  definitions: LocationDefinition[],
): ValidationResult {
  try {
    return validateTrackerSave(JSON.parse(json) as unknown, definitions);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }
}

export function createTrackerSave(
  state: Pick<
    TrackerSave,
    "seedName" | "placedLocationIds" | "positions" | "connections" | "settings"
  > & Partial<Pick<TrackerSave, "activatedWarpLocationIds" | "clearedLocationIds">>,
): TrackerSave {
  return {
    schemaVersion: TRACKER_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
    activatedWarpLocationIds: state.activatedWarpLocationIds ?? [],
    clearedLocationIds: state.clearedLocationIds ?? [],
    settings: state.settings ?? { ...DEFAULT_SETTINGS },
  };
}

export function exportFilename(seedName: string | undefined, now = new Date()): string {
  const fallback = now.toISOString().slice(0, 10);
  const slug = seedName
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `tp-entrance-tracker-${slug || fallback}.json`;
}

export function downloadTrackerSave(save: TrackerSave): void {
  const blob = new Blob([`${JSON.stringify(save, null, 2)}\n`], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = exportFilename(save.seedName);
  link.click();
  URL.revokeObjectURL(url);
}
