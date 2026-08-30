import type { Edge, Node, XYPosition } from "@xyflow/react";

export type EntranceType =
  | "overworld"
  | "interior"
  | "cave"
  | "grotto"
  | "one-way"
  | "dungeons"
  | "boss-room";

export type EntranceDirection = "both" | "in" | "out";
export type LocationKind =
  | "overworld"
  | "interior"
  | "cave"
  | "grotto"
  | "dungeon"
  | "boss-room";
export type SpecialFlag = "hyrule-castle";

export interface EntranceSourceRow {
  sheet: string;
  row: number;
  group: string;
  vanillaEntrance: string;
}

export interface EntranceDefinition {
  id: string;
  name: string;
  type: EntranceType;
  direction: EntranceDirection;
  sourceLabels?: string[];
  sourceRows?: EntranceSourceRow[];
  specialFlags?: SpecialFlag[];
}

export interface LocationDefinition {
  id: string;
  name: string;
  hasWarp?: boolean;
  locationKind: LocationKind;
  primaryGroup: string;
  sourceSheets?: string[];
  sourceGroups?: string[];
  specialFlags?: SpecialFlag[];
  entrances: EntranceDefinition[];
}

export interface LocationDataset {
  schemaVersion: number;
  datasetVersion: string;
  game: string;
  randomizerVersion: string;
  sourceWorkbook: string;
  entranceTypes: EntranceType[];
  notes: string[];
  normalizedAliases: Array<{ source: string; normalized: string }>;
  stats: {
    locationCount: number;
    entranceCount: number;
    entrancesByType: Record<EntranceType, number>;
    oneWayOutCount: number;
    oneWayInCount: number;
  };
  locations: LocationDefinition[];
}

export interface TrackerConnection {
  id: string;
  sourceLocationId: string;
  sourceEntranceId: string;
  targetLocationId: string;
  targetEntranceId: string;
  direction: "discovered";
  arrowMode: ArrowMode;
}

export type ArrowMode = "forward" | "reverse" | "bidirectional";

export interface TrackerSettings {
  showMinimap: boolean;
  defaultArrowMode: ArrowMode;
  hidePlacedLocations: boolean;
}

export interface TrackerSave {
  schemaVersion: 2;
  trackerVersion: string;
  seedName?: string;
  savedAt: string;
  placedLocationIds: string[];
  clearedLocationIds: string[];
  positions: Record<string, XYPosition>;
  connections: TrackerConnection[];
  activatedWarpLocationIds: string[];
  settings: TrackerSettings;
}

export interface LocationNodeData extends Record<string, unknown> {
  location: LocationDefinition;
  connectedEntranceIds: string[];
  accessible: boolean;
  cleared: boolean;
  presentation: "expanded" | "minimized";
  warpRouteEntranceIds: string[];
  focusState?: "selected" | "related" | "warp-route" | "warp-destination" | "dimmed";
  onRemoveLocation?: (locationId: string) => void;
  onToggleCleared?: (locationId: string) => void;
  onToggleWarp?: (locationId: string) => void;
}

export type LocationFlowNode = Node<LocationNodeData, "location">;
export type TrackerFlowEdge = Edge<{
  connection: TrackerConnection;
  focusState?: "related" | "warp-route" | "dimmed";
}, "tracker">;
