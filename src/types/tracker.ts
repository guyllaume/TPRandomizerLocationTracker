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
export type DatasetVersion = "0.1" | "0.2";

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
  datasetVersion: DatasetVersion;
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
  color?: ConnectionColor;
}

export type ArrowMode = "forward" | "reverse" | "bidirectional";
export type ConnectionColor = "blue" | "violet" | "orange" | "rose";

export interface TrackerSettings {
  showMinimap: boolean;
  defaultArrowMode: ArrowMode;
  hidePlacedLocations: boolean;
}

export interface TrackerSave {
  schemaVersion: 1;
  appVersion: string;
  datasetVersion: DatasetVersion;
  seedName?: string;
  startLocationId: string | null;
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
  selected: boolean;
  connectedEntranceIds: string[];
  accessible: boolean;
  cleared: boolean;
  presentation: "expanded" | "minimized";
  warpRouteEntranceIds: string[];
  focusedConnectionEntranceIds: string[];
  connectionIdsByEntranceId: Record<string, string[]>;
  connectionEndpointFocused: boolean;
  isStart?: boolean;
  hasStartLocation?: boolean;
  focusState?: "selected" | "related" | "warp-route" | "warp-destination" | "dimmed";
  onRemoveLocation?: (locationId: string) => void;
  onToggleCleared?: (locationId: string) => void;
  onToggleWarp?: (locationId: string) => void;
  onToggleStart?: (locationId: string) => void;
  onConnectionHoverChange?: (connectionIds: readonly string[]) => void;
}

export type LocationFlowNode = Node<LocationNodeData, "location">;
export type TrackerFlowEdge = Edge<{
  connection: TrackerConnection;
  focusState?: "related" | "warp-route" | "dimmed";
  connectionFocusState?: "focused" | "dimmed";
}, "tracker">;
