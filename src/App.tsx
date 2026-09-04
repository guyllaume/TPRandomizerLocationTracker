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
  CURRENT_DATASET_VERSION,
  locationDefinitionsByDatasetVersion,
  resolveLocationDataset,
} from "./data/locationDatasets";
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
import {
  availableWarpDestinationIds,
  toggleStartLocationId,
} from "./tracker/startLocation";
import type {
  ArrowMode,
  DatasetVersion,
  LocationDefinition,
  LocationFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
  TrackerSettings,
} from "./types/tracker";

const nodeTypes: NodeTypes = { location: LocationNode };
const edgeTypes: EdgeTypes = { tracker: TrackerEdge };

function definitionsForIds(
  ids: string[],
  locationsById: ReadonlyMap<string, LocationDefinition>,
): LocationDefinition[] {
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
  const [initial] = useState(() => readStoredTracker(locationDefinitionsByDatasetVersion));
  const initialDatasetVersion = initial.save?.datasetVersion ?? CURRENT_DATASET_VERSION;
  const initialLocations = resolveLocationDataset(initialDatasetVersion).locations;
  const initialLocationsById = new Map(
    initialLocations.map((location) => [location.id, location]),
  );
  const initialPlacedIds = initial.save?.placedLocationIds ?? [];
  const initialConnections = initial.save?.connections ?? [];
  const [nodes, setNodes, onNodesChange] = useNodesState<LocationFlowNode>(
    buildNodes(
      definitionsForIds(initialPlacedIds, initialLocationsById),
      initial.save?.positions ?? {},
      initialConnections,
    ),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<TrackerFlowEdge>(
    buildEdges(initialConnections),
  );
  const [seedName, setSeedName] = useState(initial.save?.seedName ?? "");
  const [datasetVersion, setDatasetVersion] = useState<DatasetVersion>(initialDatasetVersion);
  const [settings, setSettings] = useState<TrackerSettings>(
    initial.save?.settings ?? { ...DEFAULT_SETTINGS },
  );
  const [activatedWarpLocationIds, setActivatedWarpLocationIds] = useState<string[]>(
    initial.save?.activatedWarpLocationIds ?? [],
  );
  const [startLocationId, setStartLocationId] = useState<string | null>(
    initial.save?.startLocationId ?? null,
  );
  const [clearedLocationIds, setClearedLocationIds] = useState<string[]>(
    initial.save?.clearedLocationIds ?? [],
  );
  const [notice, setNotice] = useState(initial.notice ?? initial.error ?? "");
  const [storageWarning, setStorageWarning] = useState(
    initial.storageAvailable ? "" : initial.error ?? "Browser persistence is unavailable.",
  );
  const [persistenceAllowed, setPersistenceAllowed] = useState(initial.persistenceAllowed);
  const importInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<LocationFlowNode, TrackerFlowEdge> | null>(null);

  const locationDataset = useMemo(
    () => resolveLocationDataset(datasetVersion),
    [datasetVersion],
  );
  const locations = locationDataset.locations;
  const locationsById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );
  const entrancesById = useMemo(
    () => new Map(locations.flatMap((location) =>
      location.entrances.map((entrance) => [
        entrance.id,
        { locationId: location.id, entrance },
      ] as const),
    )),
    [locations],
  );
  const entranceDirectionsById = useMemo(
    () => new Map(locations.flatMap((location) =>
      location.entrances.map((entrance) => [entrance.id, entrance.direction] as const),
    )),
    [locations],
  );

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
  const availableWarpLocationIds = useMemo(
    () => availableWarpDestinationIds(activatedWarpLocationIds, startLocationId),
    [activatedWarpLocationIds, startLocationId],
  );
  const availableWarpLocationIdSet = useMemo(
    () => new Set(availableWarpLocationIds),
    [availableWarpLocationIds],
  );
  const clearedLocationIdSet = useMemo(
    () => new Set(clearedLocationIds),
    [clearedLocationIds],
  );
  const locationGraph = useMemo(
    () => buildLocationGraph(connections, entranceDirectionsById),
    [connections, entranceDirectionsById],
  );
  // Physical portal activation remains separate from START's derived warp availability.
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
          availableWarpLocationIds,
          availableWarpLocationIdSet,
        )
      : [],
    [availableWarpLocationIdSet, availableWarpLocationIds, locationGraph, selectedLocationId],
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

  const changeDatasetVersion = useCallback((nextVersion: DatasetVersion) => {
    if (nextVersion === datasetVersion) return;
    if (connections.length > 0) {
      setNotice("Location dataset cannot be changed after entrance connections are recorded.");
      return;
    }

    const nextLocations = resolveLocationDataset(nextVersion).locations;
    const nextLocationsById = new Map(nextLocations.map((location) => [location.id, location]));
    const incompatibleLocationIds = placedLocationIds.filter((id) => !nextLocationsById.has(id));
    if (incompatibleLocationIds.length > 0) {
      setNotice(
        `Cannot switch location datasets while ${incompatibleLocationIds.length} incompatible ` +
        `location${incompatibleLocationIds.length === 1 ? " is" : "s are"} placed. Remove ` +
        `${incompatibleLocationIds.join(", ")} first.`,
      );
      return;
    }

    setDatasetVersion(nextVersion);
    setNodes(buildNodes(
      definitionsForIds(placedLocationIds, nextLocationsById),
      positions,
      [],
    ));
    const datasetNotice = nextVersion === CURRENT_DATASET_VERSION
        ? "Using current v0.2 location definitions."
        : "Using legacy pre-v0.2 location definitions for this run.";
    setNotice(datasetNotice);
  }, [connections.length, datasetVersion, placedLocationIds, positions, setNodes]);

  const toggleWarp = useCallback((locationId: string) => {
    const location = locationsById.get(locationId);
    if (!location?.hasWarp) return;
    setActivatedWarpLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId].sort(),
    );
  }, [locationsById]);

  const toggleCleared = useCallback((locationId: string) => {
    if (!locationsById.has(locationId)) return;
    setClearedLocationIds((current) => toggleClearedLocationId(current, locationId));
  }, [locationsById]);

  const toggleStart = useCallback((locationId: string) => {
    if (!locationsById.has(locationId)) return;
    setStartLocationId((current) => toggleStartLocationId(current, locationId));
  }, [locationsById]);

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
    setStartLocationId((current) => current === locationId ? null : current);
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
      startLocationId,
      toggleStart,
    ),
    [
      clearedLocationIdSet,
      connections,
      nodes,
      removeLocation,
      startLocationId,
      toggleCleared,
      toggleStart,
      toggleWarp,
    ],
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
      datasetVersion,
      placedLocationIds,
      positions,
      connections,
      activatedWarpLocationIds,
      startLocationId,
      clearedLocationIds,
      settings,
    }),
    [
      activatedWarpLocationIds,
      clearedLocationIds,
      connections,
      datasetVersion,
      placedLocationIds,
      positions,
      seedName,
      settings,
      startLocationId,
    ],
  );

  const handleStorageError = useCallback((message: string) => setStorageWarning(message), []);
  useTrackerPersistence(persistenceState, handleStorageError, persistenceAllowed);

  const isConnectionValid = useCallback((candidate: Connection | Edge) => {
    if (!candidate.sourceHandle || !candidate.targetHandle) return false;
    const source = entrancesById.get(candidate.sourceHandle);
    const target = entrancesById.get(candidate.targetHandle);
    return source?.locationId === candidate.source &&
      target?.locationId === candidate.target &&
      source.entrance.direction !== "in" &&
      target.entrance.direction !== "out" &&
      !(candidate.source === candidate.target && candidate.sourceHandle === candidate.targetHandle);
  }, [entrancesById]);

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
  }, [connections, entrancesById, isConnectionValid, setEdges, settings.defaultArrowMode]);

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
  }, [connections, entrancesById, isConnectionValid, setEdges]);

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
    [entrancesById, setEdges],
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
  }, [connections, locationsById, nodes.length, placedLocationIdSet, setNodes]);

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
      const result = parseTrackerSave(await file.text(), locationDefinitionsByDatasetVersion);
      if (!result.ok) {
        setNotice(`Import failed: ${result.error} Your current run was not changed.`);
        return;
      }

      const importedLocations = resolveLocationDataset(result.save.datasetVersion).locations;
      const importedLocationsById = new Map(
        importedLocations.map((location) => [location.id, location]),
      );
      setDatasetVersion(result.save.datasetVersion);
      setNodes(buildNodes(
        definitionsForIds(result.save.placedLocationIds, importedLocationsById),
        result.save.positions,
        result.save.connections,
      ));
      setEdges(buildEdges(result.save.connections));
      setSeedName(result.save.seedName ?? "");
      setActivatedWarpLocationIds(result.save.activatedWarpLocationIds);
      setStartLocationId(result.save.startLocationId);
      setClearedLocationIds(result.save.clearedLocationIds);
      setSettings(result.save.settings);
      setPersistenceAllowed(true);
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
    setPersistenceAllowed(true);
    setNodes([]);
    setEdges([]);
    setSeedName("");
    setDatasetVersion(CURRENT_DATASET_VERSION);
    setActivatedWarpLocationIds([]);
    setStartLocationId(null);
    setClearedLocationIds([]);
    setSettings({ ...DEFAULT_SETTINGS });
    setNotice("Run reset. The canvas has no locations or connections.");
  }, [setEdges, setNodes]);

  return (
    <main className="app-shell">
      <TrackerToolbar
        seedName={seedName}
        datasetVersion={datasetVersion}
        datasetVersionLocked={connections.length > 0}
        locations={locations}
        placedLocationIds={placedLocationIdSet}
        connectionCount={connections.length}
        showMinimap={settings.showMinimap}
        defaultArrowMode={settings.defaultArrowMode}
        importInputRef={importInputRef}
        onSeedNameChange={setSeedName}
        onDatasetVersionChange={changeDatasetVersion}
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
