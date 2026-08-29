import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";
import type { LocationFlowNode } from "../types/tracker";
import { EntranceHandle } from "./EntranceHandle";

function LocationNodeComponent({ id, data, selected }: NodeProps<LocationFlowNode>) {
  const connected = new Set(data.connectedEntranceIds);
  const isSpecial = data.location.specialFlags?.includes("hyrule-castle");
  const focusClass = data.focusState ? `is-${data.focusState}` : "";
  const routeEntrances = new Set(data.warpRouteEntranceIds);

  return (
    <article className={`location-node ${selected ? "is-selected" : ""} ${focusClass}`.trim()}>
      <header className="location-header">
        <div className="location-title">
          <div className="location-name-line">
            <h2>{data.location.name}</h2>
            {isSpecial && <span className="special-badge" title="Hyrule Castle special metadata">Castle</span>}
          </div>
          <p>{data.location.primaryGroup}</p>
        </div>
        <div className="location-status">
          {data.location.hasWarp && (
            <button
              type="button"
              className="warp-toggle nodrag nopan"
              aria-label={`${data.accessible ? "Deactivate" : "Activate"} ${data.location.name} warp`}
              aria-pressed={data.accessible}
              title={data.accessible ? "Deactivate warp" : "Activate warp"}
              onClick={() => data.onToggleWarp?.(id)}
            >
              <img
                className="warp-icon"
                src={data.accessible ? greenWarpIcon : redWarpIcon}
                alt=""
              />
            </button>
          )}
          <span
            className="location-progress"
            aria-label={`${connected.size} of ${data.location.entrances.length} discovered`}
          >
            {connected.size} / {data.location.entrances.length}
          </span>
        </div>
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
            onWarpRoute={routeEntrances.has(entrance.id)}
          />
        ))}
      </div>
    </article>
  );
}

export const LocationNode = memo(LocationNodeComponent);
