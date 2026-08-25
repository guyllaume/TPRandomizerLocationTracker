import type { NodeProps } from "@xyflow/react";
import type { RegionFlowNode } from "../types/tracker";
import { EntranceHandle } from "./EntranceHandle";

export function RegionNode({ data, selected }: NodeProps<RegionFlowNode>) {
  const connected = new Set(data.connectedEntranceIds);

  return (
    <article className={`region-node ${selected ? "is-selected" : ""}`}>
      <header className="region-header">
        <h2>{data.region.name}</h2>
        <span className="region-progress" aria-label={`${connected.size} of ${data.region.entrances.length} discovered`}>
          {connected.size} / {data.region.entrances.length}
        </span>
      </header>
      <div className="entrance-list">
        {data.region.entrances.map((entrance) => (
          <EntranceHandle
            key={entrance.id}
            entrance={entrance}
            connected={connected.has(entrance.id)}
          />
        ))}
      </div>
    </article>
  );
}
