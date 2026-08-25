import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import type { LocationFlowNode } from "../types/tracker";
import { EntranceHandle } from "./EntranceHandle";

function LocationNodeComponent({ id, data, selected }: NodeProps<LocationFlowNode>) {
  const connected = new Set(data.connectedEntranceIds);
  const isSpecial = data.location.specialFlags?.includes("hyrule-castle");

  return (
    <article className={`location-node ${selected ? "is-selected" : ""}`}>
      <header className="location-header">
        <div className="location-title">
          <div className="location-name-line">
            <h2>{data.location.name}</h2>
            {isSpecial && <span className="special-badge" title="Hyrule Castle special metadata">Castle</span>}
          </div>
          <p>{data.location.primaryGroup}</p>
        </div>
        <span
          className="location-progress"
          aria-label={`${connected.size} of ${data.location.entrances.length} discovered`}
        >
          {connected.size} / {data.location.entrances.length}
        </span>
        <button
          type="button"
          className="remove-location nodrag nopan"
          onClick={() => data.onRemoveLocation?.(id)}
          aria-label={`Remove ${data.location.name} from the canvas`}
          title={connected.size > 0 ? "Disconnect this location before removing it" : "Remove from canvas"}
        >
          ×
        </button>
      </header>
      <div className="entrance-list">
        {data.location.entrances.map((entrance) => (
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

export const LocationNode = memo(LocationNodeComponent);
