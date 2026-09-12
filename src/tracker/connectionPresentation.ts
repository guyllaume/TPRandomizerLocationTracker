import type { ArrowMode, ConnectionColor, TrackerConnection } from "../types/tracker";

export const CONNECTION_COLOR_OPTIONS: ReadonlyArray<{
  color: ConnectionColor | undefined;
  label: string;
}> = [
  { color: undefined, label: "Default green" },
  { color: "blue", label: "Blue" },
  { color: "violet", label: "Violet" },
  { color: "orange", label: "Orange" },
  { color: "rose", label: "Rose" },
];

const CONNECTION_COLORS = new Set<ConnectionColor>(
  CONNECTION_COLOR_OPTIONS.flatMap((option) => option.color ? [option.color] : []),
);

export function isConnectionColor(value: unknown): value is ConnectionColor {
  return typeof value === "string" && CONNECTION_COLORS.has(value as ConnectionColor);
}

export function connectionColorCss(color?: ConnectionColor): string {
  return `var(--connection-${color ?? "default"})`;
}

export function withConnectionColor(
  connection: TrackerConnection,
  color: ConnectionColor | undefined,
): TrackerConnection {
  const updated = { ...connection };
  if (color === undefined) {
    delete updated.color;
  } else {
    updated.color = color;
  }
  return updated;
}

export function withConnectionsColor(
  connections: readonly TrackerConnection[],
  color: ConnectionColor | undefined,
): TrackerConnection[] {
  return connections.map((connection) => withConnectionColor(connection, color));
}

export function withConnectionsArrowMode(
  connections: readonly TrackerConnection[],
  arrowMode: ArrowMode,
): TrackerConnection[] {
  return connections.map((connection) => ({ ...connection, arrowMode }));
}

export function connectionFocusState(
  connectionId: string,
  focusedConnectionIds: readonly string[],
): "focused" | "dimmed" | undefined {
  if (focusedConnectionIds.length === 0) return undefined;
  return focusedConnectionIds.includes(connectionId) ? "focused" : "dimmed";
}

export function focusedConnectionEntranceIds(
  connections: readonly TrackerConnection[],
  focusedConnectionIds: readonly string[],
): Set<string> {
  if (focusedConnectionIds.length === 0) return new Set();
  const focusedIds = new Set(focusedConnectionIds);
  return new Set(connections.flatMap((connection) =>
    focusedIds.has(connection.id)
      ? [connection.sourceEntranceId, connection.targetEntranceId]
      : []
  ));
}
