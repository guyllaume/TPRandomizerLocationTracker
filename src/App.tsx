import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type EdgeTypes,
  type NodeTypes,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { LocationNode } from "./components/LocationNode";
import { LocationPalette } from "./components/LocationPalette";
import { TrackerEdge } from "./components/TrackerEdge";
import { TrackerToolbar } from "./components/TrackerToolbar";
import {
  entranceDirectionsById,
  entrancesById,
  locations,
  locationsById,
} from "./data/locations";
import { useTrackerPersistence } from "./hooks/useTrackerPersistence";
import { DEFAULT_SETTINGS } from "./tracker/constants";
import {
  buildEdges,
  buildLocationGraph,
  buildNodes,
  connectionFromFlow,
  edgeToConnection,
  endpointsKey,
  findShortestAccessibleWarpRoutes,
  getDirectlyConnectedLocations,
  positionsFromNodes,
  updateNodeConnectionData,
  type AccessibleWarpRoute,
} from "./tracker/graph";
import {
  createTrackerSave,
  downloadTrackerSave,
  MAX_TRACKER_IMPORT_BYTES,
  parseTrackerSave,
} from "./tracker/importExport";
import { bringLocationIntoView, selectLocationNode } from "./tracker/locationJump";
import {
  deriveLocationPresentation,
  toggleClearedLocationId,
} from "./tracker/locationPresentation";
import { clearStoredTracker, readStoredTracker } from "./tracker/persistence";
import type {
  ArrowMode,
  LocationDefinition,
  LocationFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
  TrackerSettings,
} from "./types/tracker";

const nodeTypes: NodeTypes = { location: LocationNode };
const edgeTypes: EdgeTypes = { tracker: TrackerEdge };
const warpLocationIds = locations
  .filter((location) => location.hasWarp)
  .map((location) => location.id);

function definitionsForIds(ids: string[]): LocationDefinition[] {
  return ids
    .map((id) => locationsById.get(id))
    .filter((location): location is LocationDefinition => location !== undefined);
}

function newConnectionId(): string {
  const uniquePart = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `connection-${uniquePart}`;
}

function applyFocusState(
  nodes: LocationFlowNode[],
  edges: TrackerFlowEdge[],
  connections: TrackerConnection[],
  accessibleLocationIds: ReadonlySet<string>,
  warpRoutes: AccessibleWarpRoute[],
): { nodes: LocationFlowNode[]; edges: TrackerFlowEdge[] } {
  const selectedNode = nodes.find((node) => node.selected);
  if (!selectedNode) {
    return {
      nodes: nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          accessible: accessibleLocationIds.has(node.id),
          warpRouteEntranceIds: [],
          focusState: undefined,
          presentation: deriveLocationPresentation(node.data.cleared, undefined),
        },
      })),
      edges: edges.map((edge) => ({
        ...edge,
        data: edge.data ? { ...edge.data, focusState: undefined } : edge.data,
      })),
    };
  }

  const relatedLocationIds = getDirectlyConnectedLocations(selectedNode.id, connections);
  const routeLocationIds = new Set(warpRoutes.flatMap((route) => route.path));
  const routeWarpLocationIds = new Set(
    warpRoutes.filter((route) => route.distance > 0).map((route) => route.warpLocationId),
  );
  const routeConnectionIds = new Set(
    warpRoutes.flatMap((route) => route.edges.map((edge) => edge.connectionId)),
  );
  const routeEntrancesByLocation = new Map<string, Set<string>>();
  for (const route of warpRoutes) {
    for (const edge of route.edges) {
      const fromEntrances = routeEntrancesByLocation.get(edge.fromLocationId) ?? new Set<string>();
      fromEntrances.add(edge.fromEntranceId);
      routeEntrancesByLocation.set(edge.fromLocationId, fromEntrances);
      const toEntrances = routeEntrancesByLocation.get(edge.toLocationId) ?? new Set<string>();
      toEntrances.add(edge.toEntranceId);
      routeEntrancesByLocation.set(edge.toLocationId, toEntrances);
    }
  }

  const updatedNodes = nodes.map((node) => {
    let focusState: "selected" | "related" | "warp-route" | "warp-destination" | "dimmed";
    if (node.id === selectedNode.id) {
      focusState = "selected";
    } else if (routeWarpLocationIds.has(node.id)) {
      focusState = "warp-destination";
    } else if (routeLocationIds.has(node.id)) {
      focusState = "warp-route";
    } else if (relatedLocationIds.has(node.id)) {
      focusState = "related";
    } else {
      focusState = "dimmed";
    }

    return {
      ...node,
      data: {
        ...node.data,
        accessible: accessibleLocationIds.has(node.id),
        warpRouteEntranceIds: [...(routeEntrancesByLocation.get(node.id) ?? [])],
        focusState,
        presentation: deriveLocationPresentation(node.data.cleared, focusState),
      },
    };
  });

  const updatedEdges = edges.map((edge) => {
    const sourceIsSelected = edge.source === selectedNode.id;
    const targetIsSelected = edge.target === selectedNode.id;
    const sourceIsRelated = relatedLocationIds.has(edge.source);
    const targetIsRelated = relatedLocationIds.has(edge.target);

    let focusState: "related" | "warp-route" | "dimmed";
    if (routeConnectionIds.has(edge.id)) {
      focusState = "warp-route";
    } else if (
      (sourceIsSelected && targetIsRelated) ||
      (targetIsSelected && sourceIsRelated)
    ) {
      focusState = "related";
    } else {
      focusState = "dimmed";
    }

    const connection = edge.data?.connection;
    if (!connection) {
      return edge;
    }

    return {
      ...edge,
      data: {
        connection,
        focusState,
      },
    };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

export default function App() {
  const [initial] = useState(() => readStoredTracker(locations));
  const initialPlacedIds = initial.save?.placedLocationIds ?? [];
  const initialConnections = initial.save?.connections ?? [];
  const [nodes, setNodes, onNodesChange] = useNodesState<LocationFlowNode>(
    buildNodes(
      definitionsForIds(initialPlacedIds),
      initial.save?.positions ?? {},
      initialConnections,
    ),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<TrackerFlowEdge>(
    buildEdges(initialConnections),
  );
  const [seedName, setSeedName] = useState(initial.save?.seedName ?? "");
  const [settings, setSettings] = useState<TrackerSettings>(
    initial.save?.settings ?? { ...DEFAULT_SETTINGS },
  );
  const [activatedWarpLocationIds, setActivatedWarpLocationIds] = useState<string[]>(
    initial.save?.activatedWarpLocationIds ?? [],
  );
  const [clearedLocationIds, setClearedLocationIds] = useState<string[]>(
    initial.save?.clearedLocationIds ?? [],
  );
  const [notice, setNotice] = useState(initial.notice ?? initial.error ?? "");
  const [storageWarning, setStorageWarning] = useState(
    initial.storageAvailable ? "" : initial.error ?? "Browser persistence is unavailable.",
  );
  const importInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<LocationFlowNode, TrackerFlowEdge> | null>(null);

  const connections = useMemo(
    () => edges.map(edgeToConnection).filter((item): item is TrackerConnection => item !== null),
    [edges],
  );
  const placedLocationIds = useMemo(() => nodes.map((node) => node.id), [nodes]);
  const placedLocationIdSet = useMemo(() => new Set(placedLocationIds), [placedLocationIds]);
  const activatedWarpLocationIdSet = useMemo(
    () => new Set(activatedWarpLocationIds),
    [activatedWarpLocationIds],
  );
  const clearedLocationIdSet = useMemo(
    () => new Set(clearedLocationIds),
    [clearedLocationIds],
  );
  const locationGraph = useMemo(
    () => buildLocationGraph(connections, entranceDirectionsById),
    [connections],
  );
  const accessibleLocationIds = activatedWarpLocationIdSet;
  const selectedLocationId = useMemo(
    () => nodes.find((node) => node.selected)?.id,
    [nodes],
  );
  const warpRoutes = useMemo(
    () => selectedLocationId
      ? findShortestAccessibleWarpRoutes(
          locationGraph,
          selectedLocationId,
          warpLocationIds,
          accessibleLocationIds,
        )
      : [],
    [accessibleLocationIds, locationGraph, selectedLocationId],
  );
  const selectedConnection = useMemo(() => {
    const selectedEdge = edges.find((edge) => edge.selected);
    return selectedEdge ? edgeToConnection(selectedEdge) : null;
  }, [edges]);
  const selectedConnectionIsOneWay = selectedConnection
    ? entrancesById.get(selectedConnection.sourceEntranceId)?.entrance.direction !== "both" ||
      entrancesById.get(selectedConnection.targetEntranceId)?.entrance.direction !== "both"
    : false;
  const positions = useMemo(() => positionsFromNodes(nodes), [nodes]);

  const toggleWarp = useCallback((locationId: string) => {
    const location = locationsById.get(locationId);
    if (!location?.hasWarp) return;
    setActivatedWarpLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId].sort(),
    );
  }, []);

  const toggleCleared = useCallback((locationId: string) => {
    if (!locationsById.has(locationId)) return;
    setClearedLocationIds((current) => toggleClearedLocationId(current, locationId));
  }, []);

  const removeLocation = useCallback((locationId: string) => {
    if (connections.some((connection) =>
      connection.sourceLocationId === locationId || connection.targetLocationId === locationId,
    )) {
      setNotice("Disconnect this location before removing it from the canvas.");
      return;
    }
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== locationId));
    setActivatedWarpLocationIds((current) => current.filter((id) => id !== locationId));
    setClearedLocationIds((current) => current.filter((id) => id !== locationId));
    setNotice("Location removed from the canvas. Its static definition remains in the palette.");
  }, [connections, setNodes]);

  const nodesWithConnectionData = useMemo(
    () => updateNodeConnectionData(
      nodes,
      connections,
      clearedLocationIdSet,
      removeLocation,
      toggleCleared,
      toggleWarp,
    ),
    [clearedLocationIdSet, connections, nodes, removeLocation, toggleCleared, toggleWarp],
  );

  const { nodes: displayNodes, edges: displayEdges } = useMemo(
    () => applyFocusState(
      nodesWithConnectionData,
      edges,
      connections,
      accessibleLocationIds,
      warpRoutes,
    ),
    [accessibleLocationIds, connections, edges, nodesWithConnectionData, warpRoutes],
  );

  const persistenceState = useMemo(
    () => ({
      seedName: seedName.trim() || undefined,
      placedLocationIds,
      positions,
      connections,
      activatedWarpLocationIds,
      clearedLocationIds,
      settings,
    }),
    [activatedWarpLocationIds, clearedLocationIds, seedName, placedLocationIds, positions, connections, settings],
  );

  const handleStorageError = useCallback((message: string) => setStorageWarning(message), []);
  useTrackerPersistence(persistenceState, handleStorageError);

  const isConnectionValid = useCallback((candidate: Connection | Edge) => {
    if (!candidate.sourceHandle || !candidate.targetHandle) return false;
    const source = entrancesById.get(candidate.sourceHandle);
    const target = entrancesById.get(candidate.targetHandle);
    return source?.locationId === candidate.source &&
      target?.locationId === candidate.target &&
      source.entrance.direction !== "in" &&
      target.entrance.direction !== "out" &&
      !(candidate.source === candidate.target && candidate.sourceHandle === candidate.targetHandle);
  }, []);

  const addConnection = useCallback((connection: Connection) => {
    if (!isConnectionValid(connection)) {
      setNotice("That connection conflicts with an incoming or outgoing one-way entrance.");
      return;
    }
    const isOneWay = entrancesById.get(connection.sourceHandle ?? "")?.entrance.direction !== "both" ||
      entrancesById.get(connection.targetHandle ?? "")?.entrance.direction !== "both";
    const candidate = connectionFromFlow(
      connection,
      newConnectionId(),
      isOneWay ? "forward" : settings.defaultArrowMode,
    );
    if (!candidate) {
      setNotice("Choose two different entrance handles to create a connection.");
      return;
    }

    const pair = endpointsKey(candidate);
    if (connections.some((existing) => endpointsKey(existing) === pair)) {
      setNotice("That entrance connection is already recorded.");
      return;
    }

    setEdges((currentEdges) => [...currentEdges, ...buildEdges([candidate])]);
    setNotice("Connection recorded. Select it and press Delete to remove it.");
  }, [connections, isConnectionValid, setEdges, settings.defaultArrowMode]);

  const reconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    if (!isConnectionValid(connection)) {
      setNotice("That connection conflicts with an incoming or outgoing one-way entrance.");
      return;
    }
    const isOneWay = entrancesById.get(connection.sourceHandle ?? "")?.entrance.direction !== "both" ||
      entrancesById.get(connection.targetHandle ?? "")?.entrance.direction !== "both";
    const existingArrowMode = isOneWay ? "forward" :
      connections.find((existing) => existing.id === oldEdge.id)?.arrowMode ?? "forward";
    const candidate = connectionFromFlow(connection, oldEdge.id, existingArrowMode);
    if (!candidate) {
      setNotice("A connection cannot lead back to the same entrance.");
      return;
    }
    const pair = endpointsKey(candidate);
    if (connections.some(
      (existing) => existing.id !== oldEdge.id && endpointsKey(existing) === pair,
    )) {
      setNotice("That entrance connection is already recorded.");
      return;
    }

    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.id === oldEdge.id ? buildEdges([candidate])[0] : edge,
    ));
    setNotice("Connection updated.");
  }, [connections, isConnectionValid, setEdges]);

  const changeArrowMode = useCallback(
    (connection: TrackerConnection, arrowMode: ArrowMode) => {
      const isOneWay =
        entrancesById.get(connection.sourceEntranceId)?.entrance.direction !== "both" ||
        entrancesById.get(connection.targetEntranceId)?.entrance.direction !== "both";
      if (isOneWay && arrowMode !== "forward") {
        setNotice("One-way connections keep their dataset-defined direction.");
        return;
      }
      const updated = { ...connection, arrowMode };
      setEdges((currentEdges) => currentEdges.map((edge) =>
        edge.id === connection.id
          ? { ...buildEdges([updated])[0], selected: edge.selected }
          : edge,
      ));
      setNotice("Arrow direction updated.");
    },
    [setEdges],
  );

  const deleteConnection = useCallback((connectionId: string) => {
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== connectionId));
    setNotice("Connection deleted.");
  }, [setEdges]);

  const addLocation = useCallback((locationId: string) => {
    const location = locationsById.get(locationId);
    if (!location || placedLocationIdSet.has(locationId)) return;

    const bounds = canvasRef.current?.getBoundingClientRect();
    const flowPosition = bounds && flowRef.current
      ? flowRef.current.screenToFlowPosition({
          x: bounds.left + bounds.width / 2,
          y: bounds.top + bounds.height / 2,
        })
      : { x: 80, y: 80 };
    const stagger = (nodes.length % 6) * 24;
    const position = { x: flowPosition.x - 150 + stagger, y: flowPosition.y - 80 + stagger };
    setNodes((currentNodes) => [
      ...currentNodes,
      ...buildNodes([location], { [locationId]: position }, connections),
    ]);
    setNotice(`${location.name} added to the canvas.`);
  }, [connections, nodes.length, placedLocationIdSet, setNodes]);

  const jumpToLocation = useCallback((locationId: string) => {
    setNodes((currentNodes) => selectLocationNode(currentNodes, locationId));
    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge,
    ));
    void bringLocationIntoView(flowRef.current, locationId);
  }, [setEdges, setNodes]);

  const exportRun = useCallback(() => {
    downloadTrackerSave(createTrackerSave(persistenceState));
    setNotice("Run exported as a JSON backup.");
  }, [persistenceState]);

  const importRun = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_TRACKER_IMPORT_BYTES) {
      setNotice("Import failed: the selected file is larger than 5 MiB. Your current run was not changed.");
      return;
    }

    try {
      const result = parseTrackerSave(await file.text(), locations);
      if (!result.ok) {
        setNotice(`Import failed: ${result.error} Your current run was not changed.`);
        return;
      }

      setNodes(buildNodes(
        definitionsForIds(result.save.placedLocationIds),
        result.save.positions,
        result.save.connections,
      ));
      setEdges(buildEdges(result.save.connections));
      setSeedName(result.save.seedName ?? "");
      setActivatedWarpLocationIds(result.save.activatedWarpLocationIds);
      setClearedLocationIds(result.save.clearedLocationIds);
      setSettings(result.save.settings);
      setNotice(result.warnings.length > 0
        ? `Run imported. ${result.warnings.join(" ")}`
        : "Run imported successfully.");
    } catch {
      setNotice("Import failed: the file could not be read. Your current run was not changed.");
    }
  }, [setEdges, setNodes]);

  const resetRun = useCallback(() => {
    if (!window.confirm(
      "Reset this run? All placed locations, positions, and discovered connections will be cleared.",
    )) return;

    clearStoredTracker();
    setNodes([]);
    setEdges([]);
    setSeedName("");
    setActivatedWarpLocationIds([]);
    setClearedLocationIds([]);
    setSettings({ ...DEFAULT_SETTINGS });
    setNotice("Run reset. The canvas has no locations or connections.");
  }, [setEdges, setNodes]);

  return (
    <main className="app-shell">
      <TrackerToolbar
        seedName={seedName}
        locations={locations}
        placedLocationIds={placedLocationIdSet}
        connectionCount={connections.length}
        showMinimap={settings.showMinimap}
        defaultArrowMode={settings.defaultArrowMode}
        importInputRef={importInputRef}
        onSeedNameChange={setSeedName}
        onSelectLocation={jumpToLocation}
        onExport={exportRun}
        onImportClick={() => importInputRef.current?.click()}
        onImportFile={importRun}
        onReset={resetRun}
        onFitView={() => void flowRef.current?.fitView({ padding: 0.18 })}
        onToggleMinimap={() =>
          setSettings((current) => ({ ...current, showMinimap: !current.showMinimap }))
        }
        onDefaultArrowModeChange={(defaultArrowMode) =>
          setSettings((current) => ({ ...current, defaultArrowMode }))
        }
      />

      {storageWarning && (
        <div className="storage-warning" role="alert">
          <span>{storageWarning}</span>
          <button type="button" onClick={() => setStorageWarning("")} aria-label="Dismiss warning">×</button>
        </div>
      )}
      {notice && (
        <div className="notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button>
        </div>
      )}

      <div className="tracker-workspace">
        <LocationPalette
          locations={locations}
          placedLocationIds={placedLocationIdSet}
          activatedWarpLocationIds={activatedWarpLocationIdSet}
          hidePlaced={settings.hidePlacedLocations}
          onHidePlacedChange={(hidePlacedLocations) =>
            setSettings((current) => ({ ...current, hidePlacedLocations }))
          }
          onAddLocation={addLocation}
        />
        <section ref={canvasRef} className="canvas" aria-label="Entrance connection graph">
          <ReactFlow
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onInit={(instance) => { flowRef.current = instance; }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={addConnection}
            onReconnect={reconnect}
            isValidConnection={isConnectionValid}
            onEdgeClick={() =>
              setNotice("Drag either highlighted endpoint to another entrance to reconnect this arrow.")
            }
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            maxZoom={2}
            nodesConnectable
            connectOnClick
            nodesDraggable
            nodesFocusable
            edgesReconnectable
            reconnectRadius={7}
            elevateEdgesOnSelect
            deleteKeyCode={["Backspace", "Delete"]}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
            <Controls position="bottom-left" />
            {settings.showMinimap && nodes.length > 0 && (
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                nodeColor="var(--minimap-node)"
                maskColor="var(--minimap-mask)"
              />
            )}
            {selectedConnection && (
              <Panel position="top-right" className="edge-editor">
                <span>{selectedConnectionIsOneWay ? "One-way direction" : "Arrow direction"}</span>
                <div className="edge-editor-actions" role="group" aria-label="Arrow direction">
                  <button
                    type="button"
                    aria-pressed={selectedConnection.arrowMode === "forward"}
                    onClick={() => changeArrowMode(selectedConnection, "forward")}
                    title="Source to target"
                  >→</button>
                  <button
                    type="button"
                    aria-pressed={selectedConnection.arrowMode === "reverse"}
                    disabled={selectedConnectionIsOneWay}
                    onClick={() => changeArrowMode(selectedConnection, "reverse")}
                    title="Target to source"
                  >←</button>
                  <button
                    type="button"
                    aria-pressed={selectedConnection.arrowMode === "bidirectional"}
                    disabled={selectedConnectionIsOneWay}
                    onClick={() => changeArrowMode(selectedConnection, "bidirectional")}
                    title="Bidirectional"
                  >↔</button>
                  <button
                    type="button"
                    className="edge-delete-button"
                    onClick={() => deleteConnection(selectedConnection.id)}
                    title="Delete connection"
                  >Delete</button>
                </div>
              </Panel>
            )}
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="empty-canvas">
              <h2>Build this run as you explore</h2>
              <p>Search the location palette and add a card to begin. New runs start with no connections.</p>
            </div>
          )}
          <p className="canvas-help">
            Drag a handle to another entrance. One-way OUT handles start connections; IN handles receive them.
          </p>
        </section>
      </div>
    </main>
  );
}
