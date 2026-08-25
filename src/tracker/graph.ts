import { MarkerType, type XYPosition } from "@xyflow/react";
import type {
  RegionDefinition,
  RegionFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
} from "../types/tracker";

const DEFAULT_POSITIONS: Record<string, XYPosition> = {
  "faron-woods": { x: 40, y: 50 },
  "hyrule-field": { x: 390, y: 30 },
  "castle-town": { x: 740, y: 60 },
  "kakariko-village": { x: 150, y: 390 },
  "lake-hylia": { x: 510, y: 400 },
  snowpeak: { x: 860, y: 370 },
};

export function createDefaultPositions(
  definitions: RegionDefinition[],
): Record<string, XYPosition> {
  return Object.fromEntries(
    definitions.map((region, index) => [
      region.id,
      DEFAULT_POSITIONS[region.id] ?? {
        x: (index % 3) * 360 + 40,
        y: Math.floor(index / 3) * 340 + 40,
      },
    ]),
  );
}

export function buildNodes(
  definitions: RegionDefinition[],
  positions: Record<string, XYPosition>,
  connections: TrackerConnection[],
): RegionFlowNode[] {
  const connectedByRegion = new Map<string, Set<string>>();

  for (const connection of connections) {
    const source = connectedByRegion.get(connection.sourceRegionId) ?? new Set<string>();
    source.add(connection.sourceEntranceId);
    connectedByRegion.set(connection.sourceRegionId, source);

    const target = connectedByRegion.get(connection.targetRegionId) ?? new Set<string>();
    target.add(connection.targetEntranceId);
    connectedByRegion.set(connection.targetRegionId, target);
  }

  return definitions.map((region) => ({
    id: region.id,
    type: "region",
    position: positions[region.id] ?? { x: 0, y: 0 },
    data: {
      region,
      connectedEntranceIds: [...(connectedByRegion.get(region.id) ?? [])],
    },
    deletable: false,
  }));
}

export function buildEdges(connections: TrackerConnection[]): TrackerFlowEdge[] {
  return connections.map((connection) => {
    const marker = {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: "var(--accent)",
    };

    return {
      id: connection.id,
      source: connection.sourceRegionId,
      sourceHandle: connection.sourceEntranceId,
      target: connection.targetRegionId,
      targetHandle: connection.targetEntranceId,
      data: { connection },
      markerStart: connection.arrowMode !== "forward" ? marker : undefined,
      markerEnd: connection.arrowMode !== "reverse" ? marker : undefined,
      style: { strokeWidth: 2 },
      type: "tracker" as const,
    };
  });
}

export function edgeToConnection(edge: TrackerFlowEdge): TrackerConnection | null {
  if (!edge.sourceHandle || !edge.targetHandle) return null;

  return {
    id: edge.id,
    sourceRegionId: edge.source,
    sourceEntranceId: edge.sourceHandle,
    targetRegionId: edge.target,
    targetEntranceId: edge.targetHandle,
    direction: "discovered",
    arrowMode: edge.data?.connection.arrowMode ?? "forward",
  };
}

export function positionsFromNodes(
  nodes: RegionFlowNode[],
): Record<string, XYPosition> {
  return Object.fromEntries(nodes.map((node) => [node.id, node.position]));
}

export function updateNodeConnectionData(
  nodes: RegionFlowNode[],
  connections: TrackerConnection[],
): RegionFlowNode[] {
  const connectedByRegion = new Map<string, Set<string>>();
  for (const connection of connections) {
    for (const [regionId, entranceId] of [
      [connection.sourceRegionId, connection.sourceEntranceId],
      [connection.targetRegionId, connection.targetEntranceId],
    ] as const) {
      const connected = connectedByRegion.get(regionId) ?? new Set<string>();
      connected.add(entranceId);
      connectedByRegion.set(regionId, connected);
    }
  }

  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      connectedEntranceIds: [...(connectedByRegion.get(node.id) ?? [])],
    },
  }));
}

export function endpointsKey(connection: Omit<TrackerConnection, "id" | "direction">): string {
  const endpoints = [
    `${connection.sourceRegionId}:${connection.sourceEntranceId}`,
    `${connection.targetRegionId}:${connection.targetEntranceId}`,
  ].sort();
  return endpoints.join("<->");
}
