import { type MouseEvent } from "react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";
import type { LocationNodeData } from "../types/tracker";
import { EntranceHandle } from "./EntranceHandle";

interface LocationCardProps {
  id: string;
  data: LocationNodeData;
  selected?: boolean;
}

export function LocationCard({ id, data, selected = false }: LocationCardProps) {
  const connected = new Set(data.connectedEntranceIds);
  const isSpecial = data.location.specialFlags?.includes("hyrule-castle");
  const focusClass = data.focusState ? `is-${data.focusState}` : "";
  const routeEntrances = new Set(data.warpRouteEntranceIds);
  const isMinimized = data.presentation === "minimized";

  const toggleCleared = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    data.onToggleCleared?.(id);
  };

  const cardClasses = [
    "location-node",
    selected && "is-selected",
    data.cleared && "is-cleared",
    isMinimized && "is-minimized",
    focusClass,
  ].filter(Boolean).join(" ");

  return (
    <article className={cardClasses} data-location-card={id}>
      <header className="location-header">
        <div className="location-title">
          <div className="location-name-line">
            <h2>{data.location.name}</h2>
            {isSpecial && <span className="special-badge" title="Hyrule Castle special metadata">Castle</span>}
          </div>
          {!isMinimized && <p>{data.location.primaryGroup}</p>}
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
          {!isMinimized && (
            <span
              className="location-progress"
              aria-label={`${connected.size} of ${data.location.entrances.length} discovered`}
            >
              {connected.size} / {data.location.entrances.length}
            </span>
          )}
          <button
            type="button"
            className="clear-location nodrag nopan"
            aria-label={`Mark ${data.location.name} ${data.cleared ? "not cleared" : "cleared"}`}
            aria-pressed={data.cleared}
            title={data.cleared ? "Mark not cleared" : "Mark cleared"}
            onClick={toggleCleared}
          >
            <span aria-hidden="true">✓</span>
          </button>
        </div>
        {!isMinimized && (
          <button
            type="button"
            className="remove-location nodrag nopan"
            onClick={() => data.onRemoveLocation?.(id)}
            aria-label={`Remove ${data.location.name} from the canvas`}
            title={connected.size > 0 ? "Disconnect this location before removing it" : "Remove from canvas"}
          >
            ×
          </button>
        )}
      </header>
      <div
        className={`entrance-list ${isMinimized ? "is-collapsed" : ""}`}
        aria-hidden={isMinimized || undefined}
      >
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
