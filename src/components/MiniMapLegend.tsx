import type { SyntheticEvent } from "react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";
import { MINIMAP_LOCATION_KINDS } from "../tracker/minimapPresentation";

interface MiniMapLegendProps {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
}

export function MiniMapLegend({ expanded, onExpandedChange }: MiniMapLegendProps) {
  const handleToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    onExpandedChange(event.currentTarget.open);
  };

  return (
    <details className="minimap-legend" open={expanded} onToggle={handleToggle}>
      <summary>Map legend</summary>
      <div className="minimap-legend-content">
        <div className="minimap-legend-grid" aria-label="Minimap location colors">
          {MINIMAP_LOCATION_KINDS.map((item) => (
            <span key={item.kind}>
              <i style={{ backgroundColor: item.color }} aria-hidden="true" />
              {item.label}
            </span>
          ))}
        </div>
        <div className="minimap-symbols" aria-label="Minimap symbols">
          <span><b aria-hidden="true">S</b> START</span>
          <span>
            <img src={greenWarpIcon} alt="" />
            Active warp
          </span>
          <span>
            <img src={redWarpIcon} alt="" />
            Inactive warp
          </span>
        </div>
      </div>
    </details>
  );
}
