import type { Edge, Node, XYPosition } from "@xyflow/react";

export type EntranceType =
  | "overworld"
  | "interior"
  | "cave"
  | "grotto"
  | "dungeon"
  | "one-way";

export interface EntranceDefinition {
  id: string;
  name: string;
  type: EntranceType;
}

export interface RegionDefinition {
  id: string;
  name: string;
  entrances: EntranceDefinition[];
}

export interface TrackerConnection {
  id: string;
  sourceRegionId: string;
  sourceEntranceId: string;
  targetRegionId: string;
  targetEntranceId: string;
  direction: "discovered";
  arrowMode: ArrowMode;
}

export type ArrowMode = "forward" | "reverse" | "bidirectional";

export interface TrackerSettings {
  showMinimap: boolean;
  defaultArrowMode: ArrowMode;
}

export interface TrackerSave {
  schemaVersion: 1;
  trackerVersion: string;
  seedName?: string;
  savedAt: string;
  positions: Record<string, XYPosition>;
  connections: TrackerConnection[];
  settings: TrackerSettings;
}

export interface RegionNodeData extends Record<string, unknown> {
  region: RegionDefinition;
  connectedEntranceIds: string[];
}

export type RegionFlowNode = Node<RegionNodeData, "region">;
export type TrackerFlowEdge = Edge<{ connection: TrackerConnection }, "tracker">;
