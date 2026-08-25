import { MarkerType, type Connection, type XYPosition } from "@xyflow/react";
import type {
  ArrowMode,
  LocationDefinition,
  LocationFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
} from "../types/tracker";

export function buildNodes(
  definitions: LocationDefinition[],
  positions: Record<string, XYPosition>,
  connections: TrackerConnection[],
): LocationFlowNode[] {
  const connectedByLocation = connectedEntrancesByLocation(connections);

  return definitions.map((location, index) => ({
    id: location.id,
    type: "location",
    position: positions[location.id] ?? {
      x: (index % 3) * 350 + 40,
      y: Math.floor(index / 3) * 300 + 40,
    },
    data: {
      location,
      connectedEntranceIds: [...(connectedByLocation.get(location.id) ?? [])],
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
      source: connection.sourceLocationId,
      sourceHandle: connection.sourceEntranceId,
      target: connection.targetLocationId,
      targetHandle: connection.targetEntranceId,
      data: { connection },
      markerStart: connection.arrowMode !== "forward" ? marker : undefined,
      markerEnd: connection.arrowMode !== "reverse" ? marker : undefined,
      style: { strokeWidth: 2 },
      type: "tracker" as const,
    };
  });
}

export function connectionFromFlow(
  connection: Connection,
  id: string,
  arrowMode: ArrowMode,
): TrackerConnection | null {
  if (!connection.sourceHandle || !connection.targetHandle) return null;
  if (
    connection.source === connection.target &&
    connection.sourceHandle === connection.targetHandle
  ) {
    return null;
  }

  return {
    id,
    sourceLocationId: connection.source,
    sourceEntranceId: connection.sourceHandle,
    targetLocationId: connection.target,
    targetEntranceId: connection.targetHandle,
    direction: "discovered",
    arrowMode,
  };
}

export function edgeToConnection(edge: TrackerFlowEdge): TrackerConnection | null {
  if (!edge.sourceHandle || !edge.targetHandle) return null;

  return {
    id: edge.id,
    sourceLocationId: edge.source,
    sourceEntranceId: edge.sourceHandle,
    targetLocationId: edge.target,
    targetEntranceId: edge.targetHandle,
    direction: "discovered",
    arrowMode: edge.data?.connection.arrowMode ?? "forward",
  };
}

export function positionsFromNodes(
  nodes: LocationFlowNode[],
): Record<string, XYPosition> {
  return Object.fromEntries(nodes.map((node) => [node.id, node.position]));
}

export function updateNodeConnectionData(
  nodes: LocationFlowNode[],
  connections: TrackerConnection[],
  onRemoveLocation?: (locationId: string) => void,
): LocationFlowNode[] {
  const connectedByLocation = connectedEntrancesByLocation(connections);
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      connectedEntranceIds: [...(connectedByLocation.get(node.id) ?? [])],
      onRemoveLocation,
    },
  }));
}

function connectedEntrancesByLocation(
  connections: TrackerConnection[],
): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const connection of connections) {
    for (const [locationId, entranceId] of [
      [connection.sourceLocationId, connection.sourceEntranceId],
      [connection.targetLocationId, connection.targetEntranceId],
    ] as const) {
      const connected = result.get(locationId) ?? new Set<string>();
      connected.add(entranceId);
      result.set(locationId, connected);
    }
  }
  return result;
}

export function endpointsKey(connection: Omit<TrackerConnection, "id" | "direction">): string {
  const endpoints = [
    `${connection.sourceLocationId}:${connection.sourceEntranceId}`,
    `${connection.targetLocationId}:${connection.targetEntranceId}`,
  ].sort();
  return endpoints.join("<->");
}
