import { ViewportPortal } from "@xyflow/react";
import twilightPrincessMap from "../../icons/0 (1).png";

export function TrackerMap() {
  return (
    <ViewportPortal>
      <div className="map-scene-base">
        <img
          className="map-image"
          src={twilightPrincessMap}
          width="4000"
          height="4624"
          alt=""
          aria-hidden="true"
          draggable={false}
        />
        <div className="map-route-layer" aria-hidden="true" />
      </div>
    </ViewportPortal>
  );
}
