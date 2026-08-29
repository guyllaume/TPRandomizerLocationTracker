import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import type { EntranceDefinition } from "../types/tracker";

interface EntranceHandleProps {
  entrance: EntranceDefinition;
  connected: boolean;
  onWarpRoute?: boolean;
}

const TYPE_LABELS: Record<EntranceDefinition["type"], string> = {
  overworld: "World",
  interior: "Inside",
  cave: "Cave",
  grotto: "Grotto",
  "one-way": "One-way",
  dungeons: "Dungeon",
  "boss-room": "Boss",
};

function EntranceHandleComponent({ entrance, connected, onWarpRoute = false }: EntranceHandleProps) {
  const directionLabel = entrance.direction === "out"
    ? "Outgoing only"
    : entrance.direction === "in"
      ? "Arrival only"
      : "Two-way";
  const details = [TYPE_LABELS[entrance.type], directionLabel, ...(entrance.specialFlags ?? [])]
    .join(" · ");

  return (
    <div
      className={`entrance-row nodrag nopan ${connected ? "is-connected" : ""} ${onWarpRoute ? "is-warp-route" : ""}`.trim()}
      title={`${entrance.name} · ${details}`}
    >
      <span className="entrance-type-dot" data-type={entrance.type} aria-hidden="true" />
      <span className="entrance-name">{entrance.name}</span>
      <span className="entrance-meta">
        <span className="entrance-type-badge" data-type={entrance.type}>{TYPE_LABELS[entrance.type]}</span>
        {entrance.direction !== "both" && (
          <span className="direction-badge" aria-label={directionLabel}>
            {entrance.direction === "out" ? "OUT" : "IN"}
          </span>
        )}
      </span>
      <Handle
        id={entrance.id}
        type={entrance.direction === "in" ? "target" : "source"}
        position={Position.Right}
        className="entrance-handle"
        isConnectableStart={entrance.direction !== "in"}
        isConnectableEnd={entrance.direction !== "out"}
        title={`${directionLabel}: ${entrance.name}`}
        aria-label={`${directionLabel} connection handle for ${entrance.name}`}
      />
    </div>
  );
}

export const EntranceHandle = memo(EntranceHandleComponent);
