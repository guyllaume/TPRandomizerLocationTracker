import { MarkerType, type Connection, type XYPosition } from "@xyflow/react";
import type {
  ArrowMode,
  EntranceDirection,
  LocationDefinition,
  LocationFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
} from "../types/tracker";

export interface LocationGraphEdge {
  connectionId: string;
  fromLocationId: string;
  fromEntranceId: string;
  toLocationId: string;
  toEntranceId: string;
}

export type LocationGraph = Map<string, LocationGraphEdge[]>;

export interface AccessibleWarpRoute {
  warpLocationId: string;
  distance: number;
  path: string[];
  edges: LocationGraphEdge[];
}

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
      accessible: false,
      cleared: false,
      presentation: "expanded",
      warpRouteEntranceIds: [],
      isStart: false,
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
  clearedLocationIds: ReadonlySet<string>,
  onRemoveLocation?: (locationId: string) => void,
  onToggleCleared?: (locationId: string) => void,
  onToggleWarp?: (locationId: string) => void,
  startLocationId?: string | null,
  onToggleStart?: (locationId: string) => void,
): LocationFlowNode[] {
  const connectedByLocation = connectedEntrancesByLocation(connections);
  return nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      connectedEntranceIds: [...(connectedByLocation.get(node.id) ?? [])],
      cleared: clearedLocationIds.has(node.id),
      isStart: node.id === startLocationId,
      onRemoveLocation,
      onToggleCleared,
      onToggleWarp,
      onToggleStart,
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

export function getDirectlyConnectedLocations(
  selectedLocationId: string,
  connections: TrackerConnection[],
): Set<string> {
  const related = new Set<string>();
  for (const connection of connections) {
    if (connection.sourceLocationId === selectedLocationId) {
      if (connection.targetLocationId !== selectedLocationId) {
        related.add(connection.targetLocationId);
      }
    } else if (connection.targetLocationId === selectedLocationId) {
      if (connection.sourceLocationId !== selectedLocationId) {
        related.add(connection.sourceLocationId);
      }
    }
  }
  return related;
}

function addGraphEdge(graph: LocationGraph, edge: LocationGraphEdge): void {
  const outgoing = graph.get(edge.fromLocationId) ?? [];
  outgoing.push(edge);
  graph.set(edge.fromLocationId, outgoing);
}

/**
 * Builds the currently known directed location graph. The connection's saved
 * arrow mode chooses forward, reverse, or both traversal directions. Dataset
 * entrance directions additionally prevent traversal through an incompatible
 * in/out handle. Unresolved entrances have no TrackerConnection and therefore
 * never appear here.
 */
export function buildLocationGraph(
  connections: TrackerConnection[],
  entranceDirectionsById?: ReadonlyMap<string, EntranceDirection>,
): LocationGraph {
  const graph: LocationGraph = new Map();

  for (const connection of connections) {
    const forward: LocationGraphEdge = {
      connectionId: connection.id,
      fromLocationId: connection.sourceLocationId,
      fromEntranceId: connection.sourceEntranceId,
      toLocationId: connection.targetLocationId,
      toEntranceId: connection.targetEntranceId,
    };
    const reverse: LocationGraphEdge = {
      connectionId: connection.id,
      fromLocationId: connection.targetLocationId,
      fromEntranceId: connection.targetEntranceId,
      toLocationId: connection.sourceLocationId,
      toEntranceId: connection.sourceEntranceId,
    };

    const sourceDirection = entranceDirectionsById?.get(connection.sourceEntranceId);
    const targetDirection = entranceDirectionsById?.get(connection.targetEntranceId);
    const forwardAllowed = sourceDirection !== "in" && targetDirection !== "out";
    const reverseAllowed = targetDirection !== "in" && sourceDirection !== "out";

    if (connection.arrowMode !== "reverse" && forwardAllowed) {
      addGraphEdge(graph, forward);
    }
    if (connection.arrowMode !== "forward" && reverseAllowed) {
      addGraphEdge(graph, reverse);
    }
  }

  for (const outgoing of graph.values()) {
    outgoing.sort((left, right) =>
      left.toLocationId.localeCompare(right.toLocationId) ||
      left.connectionId.localeCompare(right.connectionId),
    );
  }
  return graph;
}

/** Returns every location reachable from any supplied player start node. */
export function findReachableLocationIds(
  graph: LocationGraph,
  startingLocationIds: Iterable<string>,
): Set<string> {
  const reachable = new Set<string>();
  const queue = [...new Set(startingLocationIds)].sort();

  for (const locationId of queue) reachable.add(locationId);
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    for (const edge of graph.get(current) ?? []) {
      if (reachable.has(edge.toLocationId)) continue;
      reachable.add(edge.toLocationId);
      queue.push(edge.toLocationId);
    }
  }
  return reachable;
}

/**
 * Finds every accessible warp tied for the fewest directed transitions from
 * the selected location. Each BFS starts at an available warp because the
 * player teleports there first, then follows outgoing entrances toward the
 * selected destination.
 */
export function findShortestAccessibleWarpRoutes(
  graph: LocationGraph,
  selectedLocationId: string,
  warpLocationIds: Iterable<string>,
  accessibleLocationIds: ReadonlySet<string>,
): AccessibleWarpRoute[] {
  const accessibleWarps = [...new Set(warpLocationIds)]
    .filter((locationId) => accessibleLocationIds.has(locationId))
    .sort();
  if (accessibleWarps.length === 0) return [];

  const routes = accessibleWarps.flatMap((warpLocationId): AccessibleWarpRoute[] => {
    const visited = new Set<string>([warpLocationId]);
    const previousEdgeByLocation = new Map<string, LocationGraphEdge>();
    const queue = [warpLocationId];
    for (let index = 0; index < queue.length && !visited.has(selectedLocationId); index += 1) {
      const current = queue[index];
      for (const edge of graph.get(current) ?? []) {
        if (visited.has(edge.toLocationId)) continue;
        visited.add(edge.toLocationId);
        previousEdgeByLocation.set(edge.toLocationId, edge);
        queue.push(edge.toLocationId);
      }
    }

    if (!visited.has(selectedLocationId)) return [];
    const reversedEdges: LocationGraphEdge[] = [];
    let current = selectedLocationId;
    while (current !== warpLocationId) {
      const edge = previousEdgeByLocation.get(current);
      if (!edge) break;
      reversedEdges.push(edge);
      current = edge.fromLocationId;
    }
    const edges = reversedEdges.reverse();
    return [{
      warpLocationId,
      distance: edges.length,
      path: [warpLocationId, ...edges.map((edge) => edge.toLocationId)],
      edges,
    }];
  });
  if (routes.length === 0) return [];
  const shortestDistance = Math.min(...routes.map((route) => route.distance));

  return routes
    .filter((route) => route.distance === shortestDistance)
    .sort((left, right) => left.warpLocationId.localeCompare(right.warpLocationId));
}
