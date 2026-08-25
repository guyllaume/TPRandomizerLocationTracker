import { Handle, Position } from "@xyflow/react";
import type { EntranceDefinition } from "../types/tracker";

interface EntranceHandleProps {
  entrance: EntranceDefinition;
  connected: boolean;
}

export function EntranceHandle({ entrance, connected }: EntranceHandleProps) {
  return (
    <div className={`entrance-row nodrag nopan ${connected ? "is-connected" : ""}`}>
      <span className="entrance-type-dot" data-type={entrance.type} aria-hidden="true" />
      <span className="entrance-name">{entrance.name}</span>
      <span className="entrance-status">{connected ? "Found" : "Open"}</span>
      <Handle
        id={entrance.id}
        type="source"
        position={Position.Right}
        className="entrance-handle"
        title={`Drag or click to connect ${entrance.name}`}
        aria-label={`Connection handle for ${entrance.name}`}
      />
    </div>
  );
}
