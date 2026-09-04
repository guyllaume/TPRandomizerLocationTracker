import type {
  ArrowMode,
  DatasetVersion,
  EntranceDefinition,
  LocationDefinition,
  TrackerConnection,
  TrackerSave,
} from "../types/tracker";
import {
  CURRENT_DATASET_VERSION,
  isDatasetVersion,
  LEGACY_DATASET_VERSION,
} from "../data/locationDatasets";
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
type DatasetDefinitions = Readonly<Record<DatasetVersion, LocationDefinition[]>>;

const RETIRED_LOCATION_REPLACEMENTS: Readonly<Record<string, string>> = {
  "eldin-field-grotto-platform": "eldin-field",
  "lake-hylia-bridge-grotto-ledge": "lake-hylia-bridge",
  "ordon-bridge": "south-faron-woods",
  "top-of-kakariko-watchtower": "kakariko-village",
};

const OBSOLETE_ENTRANCE_IDS: ReadonlySet<string> = new Set([
  "faron-woods--south-faron-woods-north-cave",
  "ordon-bridge--south-faron-woods",
  "south-faron-woods--behind-gate",
  "south-faron-woods--faron-woods",
  "south-faron-woods--ordon-bridge",
]);

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

function normalizeRetiredLocationReferences(
  value: Record<string, unknown>,
): { value: Record<string, unknown>; warnings: string[] } {
  const normalized = { ...value };
  const replacementsUsed = new Set<string>();
  let obsoleteConnectionCount = 0;
  const replaceId = (candidate: unknown): unknown => {
    if (typeof candidate !== "string") return candidate;
    const replacement = RETIRED_LOCATION_REPLACEMENTS[candidate];
    if (!replacement) return candidate;
    replacementsUsed.add(`${candidate} → ${replacement}`);
    return replacement;
  };

  const normalizeLocationList = (candidate: unknown): unknown => {
    if (!Array.isArray(candidate)) return candidate;
    const result: unknown[] = [];
    const seen = new Map<string, boolean>();
    for (const item of candidate) {
      const replacement = replaceId(item);
      if (typeof replacement === "string") {
        const isRetiredReference = replacement !== item;
        if (seen.has(replacement) && (isRetiredReference || seen.get(replacement))) continue;
        seen.set(replacement, isRetiredReference);
      }
      result.push(replacement);
    }
    return result;
  };

  normalized.placedLocationIds = normalizeLocationList(value.placedLocationIds);
  normalized.clearedLocationIds = normalizeLocationList(value.clearedLocationIds);
  normalized.activatedWarpLocationIds = normalizeLocationList(value.activatedWarpLocationIds);
  normalized.startLocationId = replaceId(value.startLocationId);

  if (isRecord(value.positions)) {
    const positions: Record<string, unknown> = {};
    for (const [locationId, position] of Object.entries(value.positions)) {
      if (!RETIRED_LOCATION_REPLACEMENTS[locationId]) positions[locationId] = position;
    }
    for (const [locationId, position] of Object.entries(value.positions)) {
      const replacement = replaceId(locationId) as string;
      if (!(replacement in positions)) positions[replacement] = position;
    }
    normalized.positions = positions;
  }

  if (Array.isArray(value.connections)) {
    normalized.connections = value.connections.flatMap((connection) => {
      if (!isRecord(connection)) return [connection];
      if (
        (typeof connection.sourceEntranceId === "string" &&
          OBSOLETE_ENTRANCE_IDS.has(connection.sourceEntranceId)) ||
        (typeof connection.targetEntranceId === "string" &&
          OBSOLETE_ENTRANCE_IDS.has(connection.targetEntranceId))
      ) {
        obsoleteConnectionCount += 1;
        return [];
      }
      return [{
        ...connection,
        sourceLocationId: replaceId(connection.sourceLocationId),
        targetLocationId: replaceId(connection.targetLocationId),
      }];
    });
  }

  const warnings: string[] = [];
  if (replacementsUsed.size > 0) {
    warnings.push(`Retired location references normalized (${[...replacementsUsed].join(", ")}).`);
  }
  if (obsoleteConnectionCount > 0) {
    warnings.push(
      `${obsoleteConnectionCount} connection${obsoleteConnectionCount === 1 ? "" : "s"} using obsolete entrance handles removed.`,
    );
  }

  return {
    value: normalized,
    warnings,
  };
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
  datasetVersion: DatasetVersion,
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

  const defaultArrowMode = value.settings.defaultArrowMode ?? DEFAULT_SETTINGS.defaultArrowMode;
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

  const rawStartLocationId = value.startLocationId ?? null;
  if (
    rawStartLocationId !== null &&
    (!isNonEmptyString(rawStartLocationId) || !locationIds.has(rawStartLocationId))
  ) {
    return { ok: false, error: `The save has an unknown START location: ${String(rawStartLocationId)}.` };
  }
  if (rawStartLocationId !== null && !placedSet.has(rawStartLocationId)) {
    return { ok: false, error: `The save has an unplaced START location: ${rawStartLocationId}.` };
  }
  const startLocationId = rawStartLocationId as string | null;

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
      datasetVersion,
      seedName: value.seedName as string | undefined,
      startLocationId,
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
  definitionsByDatasetVersion: DatasetDefinitions,
): ValidationResult {
  const normalized = normalizePersistedState(value);
  if (!normalized.ok) return normalized;

  let datasetVersion: DatasetVersion;
  const datasetWarnings = [...normalized.warnings];
  if (normalized.value.datasetVersion === undefined) {
    datasetVersion = LEGACY_DATASET_VERSION;
    datasetWarnings.push("Unversioned run classified as legacy dataset v0.1.");
  } else if (isDatasetVersion(normalized.value.datasetVersion)) {
    datasetVersion = normalized.value.datasetVersion;
  } else {
    return {
      ok: false,
      error: `Unsupported tracker dataset: ${String(normalized.value.datasetVersion)}.`,
    };
  }

  const selectedValue = { ...normalized.value, datasetVersion };
  const datasetState = datasetVersion === CURRENT_DATASET_VERSION
    ? normalizeRetiredLocationReferences(selectedValue)
    : { value: selectedValue, warnings: [] };

  return validateCurrentSave(
    datasetState.value,
    definitionsByDatasetVersion[datasetVersion],
    [...datasetWarnings, ...datasetState.warnings],
    datasetVersion,
  );
}

export function parseTrackerSave(
  json: string,
  definitionsByDatasetVersion: DatasetDefinitions,
): ValidationResult {
  try {
    return validateTrackerSave(JSON.parse(json) as unknown, definitionsByDatasetVersion);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }
}

export function createTrackerSave(
  state: Pick<
    TrackerSave,
    "seedName" | "placedLocationIds" | "positions" | "connections" | "settings"
  > & Partial<Pick<
    TrackerSave,
    "activatedWarpLocationIds" | "startLocationId" | "clearedLocationIds" | "datasetVersion"
  >>,
): TrackerSave {
  return {
    schemaVersion: TRACKER_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
    datasetVersion: state.datasetVersion ?? CURRENT_DATASET_VERSION,
    activatedWarpLocationIds: state.activatedWarpLocationIds ?? [],
    startLocationId: state.startLocationId ?? null,
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
