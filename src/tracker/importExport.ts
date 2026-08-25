import type {
  ArrowMode,
  EntranceDefinition,
  LocationDefinition,
  TrackerConnection,
  TrackerSave,
} from "../types/tracker";
import { DEFAULT_SETTINGS, TRACKER_SCHEMA_VERSION, TRACKER_VERSION } from "./constants";
import { endpointsKey } from "./graph";

export type ValidationResult =
  | { ok: true; save: TrackerSave; warnings: string[] }
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
): ValidationResult {
  if (!isNonEmptyString(value.trackerVersion)) {
    return { ok: false, error: "The save is missing its tracker version." };
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
    warnings: [],
    save: {
      schemaVersion: TRACKER_SCHEMA_VERSION,
      trackerVersion: value.trackerVersion,
      seedName: value.seedName as string | undefined,
      savedAt: value.savedAt,
      placedLocationIds,
      positions,
      connections,
      settings: {
        showMinimap: value.settings.showMinimap,
        defaultArrowMode,
        hidePlacedLocations,
      },
    },
  };
}

function migratePrototypeSave(
  value: Record<string, unknown>,
  definitions: LocationDefinition[],
): ValidationResult {
  if (!isRecord(value.positions) || !Array.isArray(value.connections)) {
    return { ok: false, error: "The prototype save has invalid graph state." };
  }

  const validEntrances = entranceIndex(definitions);
  const validLocationIds = new Set(definitions.map((location) => location.id));
  const positions: TrackerSave["positions"] = {};
  let ignoredPositions = 0;
  for (const [locationId, position] of Object.entries(value.positions)) {
    if (
      !validLocationIds.has(locationId) ||
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y)
    ) {
      ignoredPositions += 1;
      continue;
    }
    positions[locationId] = { x: position.x, y: position.y };
  }

  const connections: TrackerConnection[] = [];
  let ignoredConnections = 0;
  const connectionIds = new Set<string>();
  const endpointPairs = new Set<string>();
  for (const [index, oldConnection] of value.connections.entries()) {
    if (!isRecord(oldConnection)) {
      ignoredConnections += 1;
      continue;
    }
    const migrated = {
      ...oldConnection,
      sourceLocationId: oldConnection.sourceRegionId,
      targetLocationId: oldConnection.targetRegionId,
    };
    const result = validateConnection(migrated, validEntrances, index);
    if (!result.ok) {
      ignoredConnections += 1;
      continue;
    }
    const pair = endpointsKey(result.connection);
    if (connectionIds.has(result.connection.id) || endpointPairs.has(pair)) {
      ignoredConnections += 1;
      continue;
    }
    connectionIds.add(result.connection.id);
    endpointPairs.add(pair);
    connections.push(result.connection);
    if (!(result.connection.sourceLocationId in positions)) {
      positions[result.connection.sourceLocationId] = { x: 40, y: 40 };
    }
    if (!(result.connection.targetLocationId in positions)) {
      positions[result.connection.targetLocationId] = { x: 390, y: 40 };
    }
  }

  const oldSettings = isRecord(value.settings) ? value.settings : {};
  const warnings = ["Prototype save migrated to schema v2."];
  if (ignoredPositions > 0) warnings.push(`${ignoredPositions} obsolete position(s) were ignored.`);
  if (ignoredConnections > 0) warnings.push(`${ignoredConnections} obsolete connection(s) were ignored.`);

  return {
    ok: true,
    warnings,
    save: {
      schemaVersion: TRACKER_SCHEMA_VERSION,
      trackerVersion: TRACKER_VERSION,
      seedName: typeof value.seedName === "string" ? value.seedName : undefined,
      savedAt: isNonEmptyString(value.savedAt) && !Number.isNaN(Date.parse(value.savedAt))
        ? value.savedAt
        : new Date().toISOString(),
      placedLocationIds: Object.keys(positions),
      positions,
      connections,
      settings: {
        showMinimap: typeof oldSettings.showMinimap === "boolean"
          ? oldSettings.showMinimap
          : DEFAULT_SETTINGS.showMinimap,
        defaultArrowMode: isArrowMode(oldSettings.defaultArrowMode)
          ? oldSettings.defaultArrowMode
          : DEFAULT_SETTINGS.defaultArrowMode,
        hidePlacedLocations: false,
      },
    },
  };
}

export function validateTrackerSave(
  value: unknown,
  definitions: LocationDefinition[],
): ValidationResult {
  if (!isRecord(value)) return { ok: false, error: "The file does not contain a tracker save." };
  if (value.schemaVersion === 1) return migratePrototypeSave(value, definitions);
  if (value.schemaVersion !== TRACKER_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported save schema: ${String(value.schemaVersion)}.` };
  }
  return validateCurrentSave(value, definitions);
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
  >,
): TrackerSave {
  return {
    schemaVersion: TRACKER_SCHEMA_VERSION,
    trackerVersion: TRACKER_VERSION,
    savedAt: new Date().toISOString(),
    ...state,
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
