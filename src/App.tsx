import {
  Background,
  BackgroundVariant,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  SelectionMode,
  useEdgesState,
  useNodesState,
  useStoreApi,
  type Connection,
  type Edge,
  type EdgeChange,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type OnNodeDrag,
  type ReactFlowInstance,
  type XYPosition,
} from "@xyflow/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { LocationNode } from "./components/LocationNode";
import { LocationPalette } from "./components/LocationPalette";
import { MiniMapLegend } from "./components/MiniMapLegend";
import { TrackerEdge } from "./components/TrackerEdge";
import { TrackerMiniMapNode } from "./components/TrackerMiniMapNode";
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
import { bringLocationIntoView } from "./tracker/locationJump";
import {
  minimapLocationKindPresentation,
  minimapLocationMarkers,
} from "./tracker/minimapPresentation";
import {
  deriveLocationPresentation,
  toggleClearedLocationId,
} from "./tracker/locationPresentation";
import { clearStoredTracker, readStoredTracker } from "./tracker/persistence";
import {
  applyThemePreference,
  readUiPreferences,
  writeUiPreferences,
} from "./tracker/uiPreferences";
import {
  CONNECTION_COLOR_OPTIONS,
  connectionColorCss,
  connectionFocusState,
  focusedConnectionEntranceIds,
  withConnectionColor,
  withConnectionsArrowMode,
  withConnectionsColor,
} from "./tracker/connectionPresentation";
import {
  createHistory,
  pushHistory,
  redoHistory,
  undoHistory,
  type HistoryState,
} from "./tracker/history";
import {
  applyLocationSelectionChanges,
  groupDragPositions,
  locationsMovedByDrag,
  NODE_DRAG_THRESHOLD,
  positionsChanged,
  updateLocationSelection,
} from "./tracker/interactions";
import {
  availableWarpDestinationIds,
  toggleStartLocationId,
} from "./tracker/startLocation";
import type {
  ArrowMode,
  ConnectionColor,
  DatasetVersion,
  LocationDefinition,
  LocationFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
  TrackerSettings,
} from "./types/tracker";

const nodeTypes: NodeTypes = { location: LocationNode };
const edgeTypes: EdgeTypes = { tracker: TrackerEdge };

interface TrackerHistorySnapshot {
  datasetVersion: DatasetVersion;
  placedLocationIds: string[];
  positions: Record<string, XYPosition>;
  connections: TrackerConnection[];
  activatedWarpLocationIds: string[];
  startLocationId: string | null;
  clearedLocationIds: string[];
}

interface LocationDragState {
  before: TrackerHistorySnapshot;
  startingPositions: Record<string, XYPosition>;
  movedLocationIds: string[];
  draggedLocationId: string;
}

interface MarqueeSelectionControllerProps {
  cancelRef: { current: (() => void) | null };
}

function MarqueeSelectionController({ cancelRef }: MarqueeSelectionControllerProps) {
  const store = useStoreApi<LocationFlowNode, TrackerFlowEdge>();

  useEffect(() => {
    const cancel = () => store.setState({
      userSelectionActive: false,
      userSelectionRect: null,
      nodesSelectionActive: false,
    });
    cancelRef.current = cancel;
    return () => {
      if (cancelRef.current === cancel) cancelRef.current = null;
    };
  }, [cancelRef, store]);

  return null;
}

function cloneHistorySnapshot(snapshot: TrackerHistorySnapshot): TrackerHistorySnapshot {
  return {
    ...snapshot,
    placedLocationIds: [...snapshot.placedLocationIds],
    positions: Object.fromEntries(Object.entries(snapshot.positions).map(([id, position]) => [
      id,
      { ...position },
    ])),
    connections: snapshot.connections.map((connection) => ({ ...connection })),
    activatedWarpLocationIds: [...snapshot.activatedWarpLocationIds],
    clearedLocationIds: [...snapshot.clearedLocationIds],
  };
}

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest(
    "input, textarea, select, [contenteditable]:not([contenteditable='false'])",
  ) !== null;
}

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
  selectedLocationIds: ReadonlySet<string>,
  hoveredConnectionIds: readonly string[],
  accessibleLocationIds: ReadonlySet<string>,
  warpRoutes: AccessibleWarpRoute[],
): { nodes: LocationFlowNode[]; edges: TrackerFlowEdge[] } {
  const focusedEntranceIds = focusedConnectionEntranceIds(
    connections,
    hoveredConnectionIds,
  );
  if (selectedLocationIds.size === 0) {
    return {
      nodes: nodes.map((node) => ({
        ...node,
        selected: false,
        data: {
          ...node.data,
          connectionEndpointFocused: node.data.location.entrances
            .some((entrance) => focusedEntranceIds.has(entrance.id)),
          selected: false,
          accessible: accessibleLocationIds.has(node.id),
          warpRouteEntranceIds: [],
          focusedConnectionEntranceIds: node.data.location.entrances
            .map((entrance) => entrance.id)
            .filter((entranceId) => focusedEntranceIds.has(entranceId)),
          focusState: undefined,
          presentation: deriveLocationPresentation(node.data.cleared, undefined),
        },
      })),
      edges: edges.map((edge) => ({
        ...edge,
        data: edge.data ? {
          ...edge.data,
          focusState: undefined,
          connectionFocusState: connectionFocusState(edge.id, hoveredConnectionIds),
        } : edge.data,
      })),
    };
  }

  const relatedLocationIds = new Set<string>();
  for (const selectedLocationId of selectedLocationIds) {
    for (const relatedLocationId of getDirectlyConnectedLocations(
      selectedLocationId,
      connections,
    )) {
      relatedLocationIds.add(relatedLocationId);
    }
  }
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
    const connectionEndpointFocused = node.data.location.entrances
      .some((entrance) => focusedEntranceIds.has(entrance.id));
    let focusState: "selected" | "related" | "warp-route" | "warp-destination" | "dimmed";
    if (selectedLocationIds.has(node.id)) {
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
      selected: selectedLocationIds.has(node.id),
      data: {
        ...node.data,
        connectionEndpointFocused,
        selected: selectedLocationIds.has(node.id),
        accessible: accessibleLocationIds.has(node.id),
        warpRouteEntranceIds: [...(routeEntrancesByLocation.get(node.id) ?? [])],
        focusedConnectionEntranceIds: node.data.location.entrances
          .map((entrance) => entrance.id)
          .filter((entranceId) => focusedEntranceIds.has(entranceId)),
        focusState,
        presentation: deriveLocationPresentation(node.data.cleared, focusState),
      },
    };
  });

  const updatedEdges = edges.map((edge) => {
    const sourceIsSelected = selectedLocationIds.has(edge.source);
    const targetIsSelected = selectedLocationIds.has(edge.target);
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
        connectionFocusState: connectionFocusState(edge.id, hoveredConnectionIds),
      },
    };
  });

  return { nodes: updatedNodes, edges: updatedEdges };
}

export default function App() {
  const [initial] = useState(() => readStoredTracker(locationDefinitionsByDatasetVersion));
  const [uiPreferences, setUiPreferences] = useState(readUiPreferences);
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
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [hoveredConnectionIds, setHoveredConnectionIds] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryState<TrackerHistorySnapshot>>(
    () => createHistory(),
  );
  const [isDraggingLocations, setIsDraggingLocations] = useState(false);
  const [notice, setNotice] = useState(initial.notice ?? initial.error ?? "");
  const [storageWarning, setStorageWarning] = useState(
    initial.storageAvailable ? "" : initial.error ?? "Browser persistence is unavailable.",
  );
  const [persistenceAllowed, setPersistenceAllowed] = useState(initial.persistenceAllowed);
  const importInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLElement>(null);
  const flowRef = useRef<ReactFlowInstance<LocationFlowNode, TrackerFlowEdge> | null>(null);
  const locationDragRef = useRef<LocationDragState | null>(null);
  const marqueeActiveRef = useRef(false);
  const cancelMarqueeRef = useRef<(() => void) | null>(null);

  useLayoutEffect(() => {
    applyThemePreference(uiPreferences.theme, document.documentElement);
  }, [uiPreferences.theme]);

  useEffect(() => {
    writeUiPreferences(uiPreferences);
  }, [uiPreferences]);

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
  const selectedLocationIdSet = useMemo(
    () => new Set(selectedLocationIds),
    [selectedLocationIds],
  );
  const selectedLocationId = selectedLocationIds.at(-1);
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
  const selectedConnections = useMemo(() => {
    return edges
      .filter((edge) => edge.selected)
      .map(edgeToConnection)
      .filter((connection): connection is TrackerConnection => connection !== null);
  }, [edges]);
  const selectedConnectionsIncludeOneWay = selectedConnections.some((connection) =>
    entrancesById.get(connection.sourceEntranceId)?.entrance.direction !== "both" ||
    entrancesById.get(connection.targetEntranceId)?.entrance.direction !== "both"
  );
  const positions = useMemo(() => positionsFromNodes(nodes), [nodes]);

  const currentHistorySnapshot = useMemo<TrackerHistorySnapshot>(() => ({
    datasetVersion,
    placedLocationIds,
    positions,
    connections,
    activatedWarpLocationIds,
    startLocationId,
    clearedLocationIds,
  }), [
    activatedWarpLocationIds,
    clearedLocationIds,
    connections,
    datasetVersion,
    placedLocationIds,
    positions,
    startLocationId,
  ]);
  const recordHistory = useCallback((snapshot?: TrackerHistorySnapshot) => {
    const entry = cloneHistorySnapshot(snapshot ?? currentHistorySnapshot);
    setHistory((current) => pushHistory(current, entry));
  }, [currentHistorySnapshot]);

  const applyHistorySnapshot = useCallback((snapshot: TrackerHistorySnapshot) => {
    const snapshotLocations = resolveLocationDataset(snapshot.datasetVersion).locations;
    const snapshotLocationsById = new Map(
      snapshotLocations.map((location) => [location.id, location]),
    );
    setDatasetVersion(snapshot.datasetVersion);
    setNodes(buildNodes(
      definitionsForIds(snapshot.placedLocationIds, snapshotLocationsById),
      snapshot.positions,
      snapshot.connections,
    ));
    setEdges(buildEdges(snapshot.connections));
    setActivatedWarpLocationIds([...snapshot.activatedWarpLocationIds]);
    setStartLocationId(snapshot.startLocationId);
    setClearedLocationIds([...snapshot.clearedLocationIds]);
    setSelectedLocationIds((current) =>
      current.filter((locationId) => snapshot.placedLocationIds.includes(locationId))
    );
    setHoveredConnectionIds([]);
    locationDragRef.current = null;
    setIsDraggingLocations(false);
  }, [setEdges, setNodes]);

  const undo = useCallback(() => {
    const transition = undoHistory(history, cloneHistorySnapshot(currentHistorySnapshot));
    if (!transition.snapshot) return;
    setHistory(transition.history);
    applyHistorySnapshot(transition.snapshot);
    setNotice("Undid the last tracker action.");
  }, [applyHistorySnapshot, currentHistorySnapshot, history]);

  const redo = useCallback(() => {
    const transition = redoHistory(history, cloneHistorySnapshot(currentHistorySnapshot));
    if (!transition.snapshot) return;
    setHistory(transition.history);
    applyHistorySnapshot(transition.snapshot);
    setNotice("Redid the last tracker action.");
  }, [applyHistorySnapshot, currentHistorySnapshot, history]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (marqueeActiveRef.current) {
          event.preventDefault();
          marqueeActiveRef.current = false;
          cancelMarqueeRef.current?.();
        }
        setSelectedLocationIds([]);
        setHoveredConnectionIds([]);
        return;
      }
      if (isEditableTarget(event.target) || (!event.ctrlKey && !event.metaKey)) return;

      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        if (history.future.length === 0) return;
        event.preventDefault();
        redo();
      } else if (key === "z") {
        if (history.past.length === 0) return;
        event.preventDefault();
        undo();
      } else if (key === "y") {
        if (history.future.length === 0) return;
        event.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [history.future.length, history.past.length, redo, undo]);

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

    recordHistory();
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
  }, [connections.length, datasetVersion, placedLocationIds, positions, recordHistory, setNodes]);

  const toggleWarp = useCallback((locationId: string) => {
    const location = locationsById.get(locationId);
    if (!location?.hasWarp) return;
    recordHistory();
    setActivatedWarpLocationIds((current) =>
      current.includes(locationId)
        ? current.filter((id) => id !== locationId)
        : [...current, locationId].sort(),
    );
  }, [locationsById, recordHistory]);

  const toggleCleared = useCallback((locationId: string) => {
    if (!locationsById.has(locationId)) return;
    recordHistory();
    setClearedLocationIds((current) => toggleClearedLocationId(current, locationId));
  }, [locationsById, recordHistory]);

  const toggleStart = useCallback((locationId: string) => {
    if (!locationsById.has(locationId)) return;
    recordHistory();
    setStartLocationId((current) => toggleStartLocationId(current, locationId));
  }, [locationsById, recordHistory]);

  const removeLocation = useCallback((locationId: string) => {
    if (connections.some((connection) =>
      connection.sourceLocationId === locationId || connection.targetLocationId === locationId,
    )) {
      setNotice("Disconnect this location before removing it from the canvas.");
      return;
    }
    recordHistory();
    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== locationId));
    setActivatedWarpLocationIds((current) => current.filter((id) => id !== locationId));
    setClearedLocationIds((current) => current.filter((id) => id !== locationId));
    setStartLocationId((current) => current === locationId ? null : current);
    setSelectedLocationIds((current) => current.filter((id) => id !== locationId));
    setNotice("Location removed from the canvas. Its static definition remains in the palette.");
  }, [connections, recordHistory, setNodes]);

  const handleConnectionHoverChange = useCallback((connectionIds: readonly string[]) => {
    setHoveredConnectionIds([...connectionIds]);
  }, []);

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
      handleConnectionHoverChange,
    ),
    [
      clearedLocationIdSet,
      connections,
      handleConnectionHoverChange,
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
      selectedLocationIdSet,
      hoveredConnectionIds,
      accessibleLocationIds,
      warpRoutes,
    ),
    [
      accessibleLocationIds,
      connections,
      edges,
      hoveredConnectionIds,
      nodesWithConnectionData,
      selectedLocationIdSet,
      warpRoutes,
    ],
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
  useTrackerPersistence(
    persistenceState,
    handleStorageError,
    persistenceAllowed && !isDraggingLocations,
  );

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

    recordHistory();
    setEdges((currentEdges) => [...currentEdges, ...buildEdges([candidate])]);
    setNotice("Connection recorded. Select it and press Delete to remove it.");
  }, [
    connections,
    entrancesById,
    isConnectionValid,
    recordHistory,
    setEdges,
    settings.defaultArrowMode,
  ]);

  const reconnect = useCallback((oldEdge: Edge, connection: Connection) => {
    if (!isConnectionValid(connection)) {
      setNotice("That connection conflicts with an incoming or outgoing one-way entrance.");
      return;
    }
    const isOneWay = entrancesById.get(connection.sourceHandle ?? "")?.entrance.direction !== "both" ||
      entrancesById.get(connection.targetHandle ?? "")?.entrance.direction !== "both";
    const existingConnection = connections.find((existing) => existing.id === oldEdge.id);
    const existingArrowMode = isOneWay ? "forward" :
      existingConnection?.arrowMode ?? "forward";
    const flowCandidate = connectionFromFlow(connection, oldEdge.id, existingArrowMode);
    if (!flowCandidate) {
      setNotice("A connection cannot lead back to the same entrance.");
      return;
    }
    const candidate = withConnectionColor(flowCandidate, existingConnection?.color);
    const pair = endpointsKey(candidate);
    if (connections.some(
      (existing) => existing.id !== oldEdge.id && endpointsKey(existing) === pair,
    )) {
      setNotice("That entrance connection is already recorded.");
      return;
    }

    recordHistory();
    setHoveredConnectionIds([]);
    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.id === oldEdge.id ? buildEdges([candidate])[0] : edge,
    ));
    setNotice("Connection updated.");
  }, [connections, entrancesById, isConnectionValid, recordHistory, setEdges]);

  const changeArrowMode = useCallback(
    (selected: readonly TrackerConnection[], arrowMode: ArrowMode) => {
      if (selected.length === 0) return;
      const includesOneWay = selected.some((connection) =>
        entrancesById.get(connection.sourceEntranceId)?.entrance.direction !== "both" ||
        entrancesById.get(connection.targetEntranceId)?.entrance.direction !== "both"
      );
      if (includesOneWay && arrowMode !== "forward") {
        setNotice("A selection containing one-way connections must keep the forward direction.");
        return;
      }
      if (selected.every((connection) => connection.arrowMode === arrowMode)) return;
      const updatedById = new Map(
        withConnectionsArrowMode(selected, arrowMode).map((connection) => [
          connection.id,
          connection,
        ]),
      );
      recordHistory();
      setEdges((currentEdges) => currentEdges.map((edge) =>
        updatedById.has(edge.id)
          ? { ...buildEdges([updatedById.get(edge.id)!])[0], selected: edge.selected }
          : edge
      ));
      setNotice(
        selected.length === 1
          ? "Arrow direction updated."
          : `Arrow direction updated for ${selected.length} connections.`,
      );
    },
    [entrancesById, recordHistory, setEdges],
  );

  const changeConnectionColor = useCallback((
    selected: readonly TrackerConnection[],
    color: ConnectionColor | undefined,
  ) => {
    if (selected.length === 0 || selected.every((connection) => connection.color === color)) return;
    const updatedById = new Map(
      withConnectionsColor(selected, color).map((connection) => [connection.id, connection]),
    );
    recordHistory();
    setEdges((currentEdges) => currentEdges.map((edge) =>
      updatedById.has(edge.id)
        ? { ...buildEdges([updatedById.get(edge.id)!])[0], selected: edge.selected }
        : edge
    ));
    const connectionLabel = selected.length === 1
      ? "Connection"
      : `${selected.length} connections`;
    setNotice(color
      ? `${connectionLabel} changed to ${color}.`
      : `${connectionLabel} restored to the default color.`);
  }, [recordHistory, setEdges]);

  const deleteConnections = useCallback((connectionIds: readonly string[]) => {
    const selectedIds = new Set(connectionIds);
    if (selectedIds.size === 0) return;
    const deletedCount = connections.filter((connection) => selectedIds.has(connection.id)).length;
    if (deletedCount === 0) return;
    recordHistory();
    setHoveredConnectionIds((current) =>
      current.filter((connectionId) => !selectedIds.has(connectionId))
    );
    setEdges((currentEdges) => currentEdges.filter((edge) => !selectedIds.has(edge.id)));
    setNotice(deletedCount === 1 ? "Connection deleted." : `${deletedCount} connections deleted.`);
  }, [connections, recordHistory, setEdges]);

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
    recordHistory();
    setNodes((currentNodes) => [
      ...currentNodes,
      ...buildNodes([location], { [locationId]: position }, connections),
    ]);
    setNotice(`${location.name} added to the canvas.`);
  }, [
    connections,
    locationsById,
    nodes.length,
    placedLocationIdSet,
    recordHistory,
    setNodes,
  ]);

  const jumpToLocation = useCallback((locationId: string) => {
    setSelectedLocationIds([locationId]);
    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge,
    ));
    void bringLocationIntoView(flowRef.current, locationId);
  }, [setEdges]);

  const handleNodeClick = useCallback((
    event: ReactMouseEvent,
    node: LocationFlowNode,
  ) => {
    if (event.target instanceof Element && event.target.closest(".react-flow__handle")) return;
    setSelectedLocationIds((current) =>
      updateLocationSelection(current, node.id, event.ctrlKey || event.metaKey)
    );
    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge,
    ));
  }, [setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange<LocationFlowNode>[]) => {
    if (marqueeActiveRef.current) {
      const selectionChanges = changes.flatMap((change) =>
        change.type === "select"
          ? [{ id: change.id, selected: change.selected }]
          : []
      );
      if (selectionChanges.length > 0) {
        setSelectedLocationIds((current) =>
          applyLocationSelectionChanges(current, selectionChanges)
        );
      }
    }

    const positionAndDimensionChanges = changes.filter((change) => change.type !== "select");
    if (positionAndDimensionChanges.length > 0) {
      onNodesChange(positionAndDimensionChanges);
    }
  }, [onNodesChange]);

  const handleSelectionStart = useCallback(() => {
    marqueeActiveRef.current = true;
    setSelectedLocationIds([]);
    setEdges((currentEdges) => currentEdges.map((edge) =>
      edge.selected ? { ...edge, selected: false } : edge
    ));
  }, [setEdges]);

  const handleSelectionEnd = useCallback(() => {
    marqueeActiveRef.current = false;
    requestAnimationFrame(() => cancelMarqueeRef.current?.());
  }, []);

  const handleNodeDragStart = useCallback<OnNodeDrag<LocationFlowNode>>((_, node) => {
    const startingPositions = positionsFromNodes(nodes);
    const movedLocationIds = locationsMovedByDrag(selectedLocationIds, node.id)
      .filter((locationId) => startingPositions[locationId] !== undefined);
    locationDragRef.current = {
      before: cloneHistorySnapshot(currentHistorySnapshot),
      startingPositions,
      movedLocationIds,
      draggedLocationId: node.id,
    };
    setIsDraggingLocations(true);
  }, [currentHistorySnapshot, nodes, selectedLocationIds]);

  const handleNodeDrag = useCallback<OnNodeDrag<LocationFlowNode>>((_, node) => {
    const drag = locationDragRef.current;
    if (!drag || drag.draggedLocationId !== node.id || drag.movedLocationIds.length < 2) return;
    const nextPositions = groupDragPositions(
      drag.startingPositions,
      drag.movedLocationIds,
      drag.draggedLocationId,
      node.position,
    );
    setNodes((currentNodes) => currentNodes.map((currentNode) =>
      currentNode.id !== node.id && nextPositions[currentNode.id]
        ? { ...currentNode, position: nextPositions[currentNode.id], dragging: true }
        : currentNode,
    ));
  }, [setNodes]);

  const handleNodeDragStop = useCallback<OnNodeDrag<LocationFlowNode>>((_, node) => {
    const drag = locationDragRef.current;
    locationDragRef.current = null;
    setIsDraggingLocations(false);
    if (!drag || drag.draggedLocationId !== node.id) return;

    const finalPositions = groupDragPositions(
      drag.startingPositions,
      drag.movedLocationIds,
      drag.draggedLocationId,
      node.position,
    );
    setNodes((currentNodes) => currentNodes.map((currentNode) =>
      finalPositions[currentNode.id]
        ? { ...currentNode, position: finalPositions[currentNode.id], dragging: false }
        : currentNode,
    ));
    if (positionsChanged(
      drag.startingPositions,
      finalPositions,
      drag.movedLocationIds,
    )) {
      recordHistory(drag.before);
    }
  }, [recordHistory, setNodes]);

  const handleEdgesChange = useCallback((changes: EdgeChange<TrackerFlowEdge>[]) => {
    const removedConnectionIds = new Set(
      changes.flatMap((change) => change.type === "remove" ? [change.id] : []),
    );
    if (removedConnectionIds.size > 0) {
      recordHistory();
      setHoveredConnectionIds((current) =>
        current.filter((connectionId) => !removedConnectionIds.has(connectionId))
      );
    }
    const applicableChanges = marqueeActiveRef.current
      ? changes.filter((change) => change.type !== "select")
      : changes;
    if (applicableChanges.length > 0) {
      onEdgesChange(applicableChanges);
    }
  }, [onEdgesChange, recordHistory]);

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
      setSelectedLocationIds([]);
      setHoveredConnectionIds([]);
      setHistory(createHistory());
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
    setSelectedLocationIds([]);
    setHoveredConnectionIds([]);
    setHistory(createHistory());
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
        selectedLocationCount={selectedLocationIds.length}
        canUndo={history.past.length > 0}
        canRedo={history.future.length > 0}
        showMinimap={settings.showMinimap}
        defaultArrowMode={settings.defaultArrowMode}
        theme={uiPreferences.theme}
        importInputRef={importInputRef}
        onSeedNameChange={setSeedName}
        onDatasetVersionChange={changeDatasetVersion}
        onSelectLocation={jumpToLocation}
        onUndo={undo}
        onRedo={redo}
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
        onThemeChange={(theme) =>
          setUiPreferences((current) => ({ ...current, theme }))
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

      <div className={`tracker-workspace ${uiPreferences.sidebarCollapsed ? "is-sidebar-collapsed" : ""}`.trim()}>
        <LocationPalette
          locations={locations}
          placedLocationIds={placedLocationIdSet}
          activatedWarpLocationIds={activatedWarpLocationIdSet}
          hidePlaced={settings.hidePlacedLocations}
          collapsed={uiPreferences.sidebarCollapsed}
          onHidePlacedChange={(hidePlacedLocations) =>
            setSettings((current) => ({ ...current, hidePlacedLocations }))
          }
          onCollapsedChange={(sidebarCollapsed) =>
            setUiPreferences((current) => ({ ...current, sidebarCollapsed }))
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
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onNodeClick={handleNodeClick}
            onNodeDragStart={handleNodeDragStart}
            onNodeDrag={handleNodeDrag}
            onNodeDragStop={handleNodeDragStop}
            onSelectionStart={handleSelectionStart}
            onSelectionEnd={handleSelectionEnd}
            onPaneClick={() => {
              setSelectedLocationIds([]);
              setHoveredConnectionIds([]);
            }}
            onConnect={addConnection}
            onReconnect={reconnect}
            isValidConnection={isConnectionValid}
            onEdgeClick={() => {
              setNotice("Drag either highlighted endpoint to another entrance to reconnect this arrow.")
            }}
            onEdgeMouseEnter={(_, edge) => setHoveredConnectionIds([edge.id])}
            onEdgeMouseLeave={(_, edge) => setHoveredConnectionIds((current) =>
              current.includes(edge.id) ? [] : current
            )}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.18 }}
            minZoom={0.25}
            maxZoom={2}
            nodesConnectable
            connectOnClick
            nodesDraggable
            selectNodesOnDrag={false}
            selectionKeyCode="Shift"
            selectionMode={SelectionMode.Partial}
            nodeDragThreshold={NODE_DRAG_THRESHOLD}
            nodeClickDistance={NODE_DRAG_THRESHOLD}
            nodesFocusable
            edgesReconnectable
            reconnectRadius={7}
            elevateEdgesOnSelect
            deleteKeyCode={["Backspace", "Delete"]}
            defaultEdgeOptions={{ className: "nokey" }}
            proOptions={{ hideAttribution: true }}
          >
            <MarqueeSelectionController cancelRef={cancelMarqueeRef} />
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} />
            <Controls position="bottom-left" />
            {settings.showMinimap && nodes.length > 0 && (
              <>
                <Panel position="bottom-right" className="minimap-legend-panel">
                  <MiniMapLegend
                    expanded={uiPreferences.minimapLegendExpanded}
                    onExpandedChange={(minimapLegendExpanded) =>
                      setUiPreferences((current) => ({ ...current, minimapLegendExpanded }))
                    }
                  />
                </Panel>
                <MiniMap<LocationFlowNode>
                  position="bottom-right"
                  style={{ width: 230, height: 165 }}
                  offsetScale={0}
                  pannable
                  zoomable
                  nodeComponent={TrackerMiniMapNode}
                  nodeColor={(node) =>
                    minimapLocationKindPresentation(node.data.location.locationKind).color
                  }
                  nodeClassName={(node) => {
                    const markers = minimapLocationMarkers(
                      node.id,
                      startLocationId,
                      availableWarpLocationIdSet,
                      Boolean(node.data.location.hasWarp),
                    );
                    return [
                      `kind-${node.data.location.locationKind}`,
                      markers.isStart && "is-start",
                      markers.warpState && `has-${markers.warpState}-warp`,
                    ].filter(Boolean).join(" ");
                  }}
                  nodeStrokeColor="var(--minimap-node-stroke)"
                  nodeStrokeWidth={0.5}
                  bgColor="var(--surface)"
                  maskColor="var(--minimap-mask)"
                  maskStrokeColor="var(--border-strong)"
                  ariaLabel="Location map; colors indicate location type and symbols indicate START and warp status"
                />
              </>
            )}
            {selectedConnections.length > 0 && (
              <Panel position="top-right" className="edge-editor">
                <span>
                  {selectedConnections.length > 1
                    ? `${selectedConnections.length} connections selected`
                    : selectedConnectionsIncludeOneWay
                      ? "One-way direction"
                      : "Arrow direction"}
                </span>
                <div className="edge-editor-actions" role="group" aria-label="Arrow direction">
                  <button
                    type="button"
                    aria-pressed={selectedConnections.every(
                      (connection) => connection.arrowMode === "forward"
                    )}
                    onClick={() => changeArrowMode(selectedConnections, "forward")}
                    title="Source to target"
                  >→</button>
                  <button
                    type="button"
                    aria-pressed={selectedConnections.every(
                      (connection) => connection.arrowMode === "reverse"
                    )}
                    disabled={selectedConnectionsIncludeOneWay}
                    onClick={() => changeArrowMode(selectedConnections, "reverse")}
                    title={selectedConnectionsIncludeOneWay
                      ? "Unavailable while the selection includes a one-way connection"
                      : "Target to source"}
                  >←</button>
                  <button
                    type="button"
                    aria-pressed={selectedConnections.every(
                      (connection) => connection.arrowMode === "bidirectional"
                    )}
                    disabled={selectedConnectionsIncludeOneWay}
                    onClick={() => changeArrowMode(selectedConnections, "bidirectional")}
                    title={selectedConnectionsIncludeOneWay
                      ? "Unavailable while the selection includes a one-way connection"
                      : "Bidirectional"}
                  >↔</button>
                  <button
                    type="button"
                    className="edge-delete-button"
                    onClick={() => deleteConnections(
                      selectedConnections.map((connection) => connection.id)
                    )}
                    title={selectedConnections.length === 1
                      ? "Delete connection"
                      : "Delete selected connections"}
                  >
                    {selectedConnections.length === 1
                      ? "Delete"
                      : `Delete ${selectedConnections.length}`}
                  </button>
                </div>
                <span>Connection color</span>
                <div className="edge-color-options" role="group" aria-label="Connection color">
                  {CONNECTION_COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.color ?? "default"}
                      type="button"
                      className="edge-color-button"
                      aria-label={option.label}
                      aria-pressed={selectedConnections.every(
                        (connection) => connection.color === option.color
                      )}
                      title={option.label}
                      onClick={() => changeConnectionColor(selectedConnections, option.color)}
                    >
                      <span
                        className="edge-color-swatch"
                        style={{ backgroundColor: connectionColorCss(option.color) }}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
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
            Shift-drag empty space to select locations. Drag a handle to connect entrances.
          </p>
        </section>
      </div>
    </main>
  );
}
