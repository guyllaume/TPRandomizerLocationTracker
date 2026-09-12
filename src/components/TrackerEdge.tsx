import {
  BaseEdge,
  Position,
  getSmoothStepPath,
  type EdgeProps,
  type XYPosition,
} from "@xyflow/react";
import type { TrackerFlowEdge } from "../types/tracker";

const ENDPOINT_OFFSET = 10;

function offsetEndpoint(
  x: number,
  y: number,
  position: Position,
): XYPosition {
  switch (position) {
    case Position.Left:
      return { x: x - ENDPOINT_OFFSET, y };
    case Position.Top:
      return { x, y: y - ENDPOINT_OFFSET };
    case Position.Bottom:
      return { x, y: y + ENDPOINT_OFFSET };
    case Position.Right:
    default:
      return { x: x + ENDPOINT_OFFSET, y };
  }
}

export function TrackerEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerStart,
  markerEnd,
  style,
  interactionWidth,
  data,
  selected,
}: EdgeProps<TrackerFlowEdge>) {
  const source = offsetEndpoint(sourceX, sourceY, sourcePosition);
  const target = offsetEndpoint(targetX, targetY, targetPosition);
  const [path] = getSmoothStepPath({
    sourceX: source.x,
    sourceY: source.y,
    sourcePosition,
    targetX: target.x,
    targetY: target.y,
    targetPosition,
    borderRadius: 8,
  });

  const focusState = data?.focusState;
  const focusStyle = focusState === "dimmed"
    ? { opacity: 0.15 }
    : focusState === "warp-route"
      ? { opacity: 1, stroke: "var(--warp-route)", strokeWidth: 4 }
      : {};
  const selectedStyle = selected
    ? { opacity: 1, strokeWidth: 3, filter: "drop-shadow(0 0 2px var(--surface))" }
    : {};
  const connectionFocusStyle = data?.connectionFocusState === "dimmed"
    ? { opacity: 0.28 }
    : data?.connectionFocusState === "focused"
      ? {
          opacity: 1,
          strokeWidth: 5,
          filter: "drop-shadow(0 0 4px var(--accent-bright))",
        }
      : {};

  return (
    <BaseEdge
      id={id}
      path={path}
      markerStart={markerStart}
      markerEnd={markerEnd}
      style={{ ...style, ...focusStyle, ...selectedStyle, ...connectionFocusStyle }}
      interactionWidth={interactionWidth}
    />
  );
}
