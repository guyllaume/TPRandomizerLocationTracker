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
} from "@xyflow/react";
import { useCallback, useMemo, useRef, useState, type ChangeEvent } from "react";
import { RegionNode } from "./components/RegionNode";
import { TrackerToolbar } from "./components/TrackerToolbar";
import { TrackerEdge } from "./components/TrackerEdge";
import { regions } from "./data/regions";
import { useTrackerPersistence } from "./hooks/useTrackerPersistence";
import { DEFAULT_SETTINGS } from "./tracker/constants";
import {
  buildEdges,
  buildNodes,
  createDefaultPositions,
  edgeToConnection,
  endpointsKey,
  positionsFromNodes,
  updateNodeConnectionData,
} from "./tracker/graph";
import {
  createTrackerSave,
  downloadTrackerSave,
  parseTrackerSave,
} from "./tracker/importExport";
import {
  clearStoredTracker,
  readStoredTracker,
} from "./tracker/persistence";
import type {
  ArrowMode,
  RegionFlowNode,
  TrackerConnection,
  TrackerFlowEdge,
  TrackerSettings,
} from "./types/tracker";

const nodeTypes: NodeTypes = { region: RegionNode };
const edgeTypes: EdgeTypes = { tracker: TrackerEdge };

function connectionFromFlow(
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
    sourceRegionId: connection.source,
    sourceEntranceId: connection.sourceHandle,
    targetRegionId: connection.target,
    targetEntranceId: connection.targetHandle,
    direction: "discovered",
    arrowMode,
  };
}

function newConnectionId(): string {
  const uniquePart = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `connection-${uniquePart}`;
}

export default function App() {
  const [initial] = useState(() => readStoredTracker(regions));
  const defaultPositions = useMemo(() => createDefaultPositions(regions), []);
  const initialPositions = { ...defaultPositions, ...initial.save?.positions };
  const initialConnections = initial.save?.connections ?? [];

  const [nodes, setNodes, onNodesChange] = useNodesState<RegionFlowNode>(
    buildNodes(regions, initialPositions, initialConnections),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<TrackerFlowEdge>(
    buildEdges(initialConnections),
  );
  const [seedName, setSeedName] = useState(initial.save?.seedName ?? "");
  const [settings, setSettings] = useState<TrackerSettings>(
    initial.save?.settings ?? { ...DEFAULT_SETTINGS },
  );
  const [notice, setNotice] = useState(initial.error ?? "");
  const [storageWarning, setStorageWarning] = useState(
    initial.storageAvailable ? "" : initial.error ?? "Browser persistence is unavailable.",
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  const connections = useMemo(
    () => edges.map(edgeToConnection).filter((item): item is TrackerConnection => item !== null),
    [edges],
  );
  const selectedConnection = useMemo(() => {
    const selectedEdge = edges.find((edge) => edge.selected);
    return selectedEdge ? edgeToConnection(selectedEdge) : null;
  }, [edges]);
  const displayNodes = useMemo(
    () => updateNodeConnectionData(nodes, connections),
    [nodes, connections],
  );
  const positions = useMemo(() => positionsFromNodes(nodes), [nodes]);
  const persistenceState = useMemo(
    () => ({
      seedName: seedName.trim() || undefined,
      positions,
      connections,
      settings,
    }),
    [seedName, positions, connections, settings],
  );

  const handleStorageError = useCallback((message: string) => {
    setStorageWarning(message);
  }, []);
  useTrackerPersistence(persistenceState, handleStorageError);

  const addConnection = useCallback(
    (connection: Connection) => {
      const candidate = connectionFromFlow(
        connection,
        newConnectionId(),
        settings.defaultArrowMode,
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
    },
    [connections, setEdges, settings.defaultArrowMode],
  );

  const reconnect = useCallback(
    (oldEdge: Edge, connection: Connection) => {
      const existingArrowMode =
        connections.find((existing) => existing.id === oldEdge.id)?.arrowMode ?? "forward";
      const candidate = connectionFromFlow(connection, oldEdge.id, existingArrowMode);
      if (!candidate) {
        setNotice("A connection cannot lead back to the same entrance.");
        return;
      }
      const pair = endpointsKey(candidate);
      if (
        connections.some(
          (existing) => existing.id !== oldEdge.id && endpointsKey(existing) === pair,
        )
      ) {
        setNotice("That entrance connection is already recorded.");
        return;
      }

      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === oldEdge.id ? buildEdges([candidate])[0] : edge,
        ),
      );
      setNotice("Connection updated.");
    },
    [connections, setEdges],
  );

  const changeArrowMode = useCallback(
    (connection: TrackerConnection, arrowMode: ArrowMode) => {
      const updated = { ...connection, arrowMode };
      setEdges((currentEdges) =>
        currentEdges.map((edge) =>
          edge.id === connection.id
            ? { ...buildEdges([updated])[0], selected: edge.selected }
            : edge,
        ),
      );
      setNotice("Arrow direction updated.");
    },
    [setEdges],
  );

  const deleteConnection = useCallback(
    (connectionId: string) => {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== connectionId));
      setNotice("Connection deleted.");
    },
    [setEdges],
  );

  const exportRun = useCallback(() => {
    downloadTrackerSave(createTrackerSave(persistenceState));
    setNotice("Run exported as a JSON backup.");
  }, [persistenceState]);

  const importRun = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        const result = parseTrackerSave(await file.text(), regions);
        if (!result.ok) {
          setNotice(`Import failed: ${result.error} Your current run was not changed.`);
          return;
        }

        const importedPositions = { ...defaultPositions, ...result.save.positions };
        setNodes(buildNodes(regions, importedPositions, result.save.connections));
        setEdges(buildEdges(result.save.connections));
        setSeedName(result.save.seedName ?? "");
        setSettings(result.save.settings);
        setNotice("Run imported successfully.");
      } catch {
        setNotice("Import failed: the file could not be read. Your current run was not changed.");
      }
    },
    [defaultPositions, setEdges, setNodes],
  );

  const resetRun = useCallback(() => {
    if (!window.confirm("Reset this run? All positions and discovered connections will be cleared.")) {
      return;
    }
    clearStoredTracker();
    setNodes(buildNodes(regions, defaultPositions, []));
    setEdges([]);
    setSeedName("");
    setSettings({ ...DEFAULT_SETTINGS });
    setNotice("Run reset.");
  }, [defaultPositions, setEdges, setNodes]);

  return (
    <main className="app-shell">
      <TrackerToolbar
        seedName={seedName}
        connectionCount={connections.length}
        showMinimap={settings.showMinimap}
        defaultArrowMode={settings.defaultArrowMode}
        importInputRef={importInputRef}
        onSeedNameChange={setSeedName}
        onExport={exportRun}
        onImportClick={() => importInputRef.current?.click()}
        onImportFile={importRun}
        onReset={resetRun}
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

      <section className="canvas" aria-label="Entrance connection graph">
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={addConnection}
          onReconnect={reconnect}
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
          {settings.showMinimap && (
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
              <span>Arrow direction</span>
              <div className="edge-editor-actions" role="group" aria-label="Arrow direction">
                <button
                  type="button"
                  aria-pressed={selectedConnection.arrowMode === "forward"}
                  onClick={() => changeArrowMode(selectedConnection, "forward")}
                  title="Source to target"
                >
                  →
                </button>
                <button
                  type="button"
                  aria-pressed={selectedConnection.arrowMode === "reverse"}
                  onClick={() => changeArrowMode(selectedConnection, "reverse")}
                  title="Target to source"
                >
                  ←
                </button>
                <button
                  type="button"
                  aria-pressed={selectedConnection.arrowMode === "bidirectional"}
                  onClick={() => changeArrowMode(selectedConnection, "bidirectional")}
                  title="Bidirectional"
                >
                  ↔
                </button>
                <button
                  type="button"
                  className="edge-delete-button"
                  onClick={() => deleteConnection(selectedConnection.id)}
                  title="Delete connection"
                >
                  Delete
                </button>
              </div>
            </Panel>
          )}
        </ReactFlow>
        <p className="canvas-help">
          Drag a circle from one entrance to another. Select an arrow and press Delete to remove it.
        </p>
      </section>
    </main>
  );
}
