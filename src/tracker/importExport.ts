import type {
  ArrowMode,
  RegionDefinition,
  TrackerConnection,
  TrackerSave,
} from "../types/tracker";
import { DEFAULT_SETTINGS, TRACKER_SCHEMA_VERSION, TRACKER_VERSION } from "./constants";
import { endpointsKey } from "./graph";

export type ValidationResult =
  | { ok: true; save: TrackerSave }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function validateConnection(
  value: unknown,
  validEntrances: Map<string, Set<string>>,
  index: number,
): { ok: true; connection: TrackerConnection } | { ok: false; error: string } {
  if (!isRecord(value)) {
    return { ok: false, error: `Connection ${index + 1} is not an object.` };
  }

  const fields = [
    "id",
    "sourceRegionId",
    "sourceEntranceId",
    "targetRegionId",
    "targetEntranceId",
  ] as const;

  for (const field of fields) {
    if (!isNonEmptyString(value[field])) {
      return { ok: false, error: `Connection ${index + 1} has an invalid ${field}.` };
    }
  }

  const sourceRegionId = value.sourceRegionId as string;
  const sourceEntranceId = value.sourceEntranceId as string;
  const targetRegionId = value.targetRegionId as string;
  const targetEntranceId = value.targetEntranceId as string;

  if (!validEntrances.get(sourceRegionId)?.has(sourceEntranceId)) {
    return { ok: false, error: `Connection ${index + 1} has an unknown source entrance.` };
  }
  if (!validEntrances.get(targetRegionId)?.has(targetEntranceId)) {
    return { ok: false, error: `Connection ${index + 1} has an unknown target entrance.` };
  }
  if (sourceRegionId === targetRegionId && sourceEntranceId === targetEntranceId) {
    return { ok: false, error: `Connection ${index + 1} connects an entrance to itself.` };
  }
  if (value.direction !== "discovered") {
    return { ok: false, error: `Connection ${index + 1} has an unsupported direction.` };
  }
  const arrowMode = value.arrowMode ?? "forward";
  if (!(["forward", "reverse", "bidirectional"] as unknown[]).includes(arrowMode)) {
    return { ok: false, error: `Connection ${index + 1} has an unsupported arrow mode.` };
  }

  return {
    ok: true,
    connection: {
      id: value.id as string,
      sourceRegionId,
      sourceEntranceId,
      targetRegionId,
      targetEntranceId,
      direction: "discovered",
      arrowMode: arrowMode as ArrowMode,
    },
  };
}

export function validateTrackerSave(
  value: unknown,
  definitions: RegionDefinition[],
): ValidationResult {
  if (!isRecord(value)) return { ok: false, error: "The file does not contain a tracker save." };
  if (value.schemaVersion !== TRACKER_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported save schema: ${String(value.schemaVersion)}.` };
  }
  if (!isNonEmptyString(value.trackerVersion)) {
    return { ok: false, error: "The save is missing its tracker version." };
  }
  if (!isNonEmptyString(value.savedAt) || Number.isNaN(Date.parse(value.savedAt))) {
    return { ok: false, error: "The save has an invalid timestamp." };
  }
  if (value.seedName !== undefined && typeof value.seedName !== "string") {
    return { ok: false, error: "The save has an invalid seed name." };
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
  if (!(["forward", "reverse", "bidirectional"] as unknown[]).includes(defaultArrowMode)) {
    return { ok: false, error: "The save has an invalid default arrow mode." };
  }

  const regionIds = new Set(definitions.map((region) => region.id));
  const positions: TrackerSave["positions"] = {};
  for (const [regionId, position] of Object.entries(value.positions)) {
    if (!regionIds.has(regionId)) {
      return { ok: false, error: `The save references an unknown region: ${regionId}.` };
    }
    if (
      !isRecord(position) ||
      typeof position.x !== "number" ||
      !Number.isFinite(position.x) ||
      typeof position.y !== "number" ||
      !Number.isFinite(position.y)
    ) {
      return { ok: false, error: `The position for ${regionId} is invalid.` };
    }
    positions[regionId] = { x: position.x, y: position.y };
  }

  const validEntrances = new Map(
    definitions.map((region) => [
      region.id,
      new Set(region.entrances.map((entrance) => entrance.id)),
    ]),
  );
  const connections: TrackerConnection[] = [];
  const ids = new Set<string>();
  const endpointPairs = new Set<string>();

  for (const [index, candidate] of value.connections.entries()) {
    const result = validateConnection(candidate, validEntrances, index);
    if (!result.ok) return result;
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
    save: {
      schemaVersion: TRACKER_SCHEMA_VERSION,
      trackerVersion: value.trackerVersion,
      seedName: value.seedName as string | undefined,
      savedAt: value.savedAt,
      positions,
      connections,
      settings: {
        showMinimap: value.settings.showMinimap,
        defaultArrowMode: defaultArrowMode as ArrowMode,
      },
    },
  };
}

export function parseTrackerSave(
  json: string,
  definitions: RegionDefinition[],
): ValidationResult {
  try {
    return validateTrackerSave(JSON.parse(json) as unknown, definitions);
  } catch {
    return { ok: false, error: "The selected file is not valid JSON." };
  }
}

export function createTrackerSave(
  state: Pick<TrackerSave, "seedName" | "positions" | "connections" | "settings">,
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
