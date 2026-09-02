import {
  Handle,
  NodeToolbar,
  Position,
  useViewport,
} from "@xyflow/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import greenWarpIcon from "../../icons/ezgif-482ef2a92ce44a3f.png";
import redWarpIcon from "../../icons/ezgif-4cc6456631015bee.png";
import {
  choosePopupSide,
  getPopupOffsetForMarker,
  type PopupSide,
  type ScreenRect,
} from "../tracker/popupPlacement";
import type { LocationFlowNode, LocationNodeData } from "../types/tracker";
import { LocationCard } from "./LocationCard";

const TOOLBAR_POSITION: Record<PopupSide, Position> = {
  right: Position.Right,
  left: Position.Left,
  top: Position.Top,
  bottom: Position.Bottom,
};

const POPUP_TRANSFORM_ORIGIN: Record<PopupSide, string> = {
  right: "left center",
  left: "right center",
  top: "center bottom",
  bottom: "center top",
};

function toScreenRect(rect: DOMRect): ScreenRect {
  return {
    left: rect.left,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

interface LocationMarkerButtonProps {
  id: string;
  data: LocationNodeData;
  selected: boolean;
  onSelect: () => void;
  buttonRef?: Ref<HTMLButtonElement>;
  style?: CSSProperties;
}

export function LocationMarkerButton({
  id,
  data,
  selected,
  onSelect,
  buttonRef,
  style,
}: LocationMarkerButtonProps) {
  const focusClass = data.focusState ? `is-${data.focusState}` : "";
  const classes = [
    "map-location-marker",
    selected && "is-selected",
    data.cleared && "is-cleared",
    focusClass,
  ].filter(Boolean).join(" ");
  const stateLabel = [
    data.cleared && "cleared",
    data.location.hasWarp && (data.accessible ? "warp active" : "warp inactive"),
  ].filter(Boolean).join(", ");

  return (
    <div className="map-marker-shell" style={style}>
      <button
        ref={buttonRef}
        type="button"
        className={classes}
        aria-label={`${data.location.name}${stateLabel ? `, ${stateLabel}` : ""}`}
        aria-pressed={selected}
        aria-describedby={`${id}-map-tooltip`}
        onClick={onSelect}
      >
        <span className="map-marker-pill" aria-hidden="true" />
        {data.cleared && <span className="map-marker-cleared" aria-hidden="true">✓</span>}
        {data.location.hasWarp && (
          <img
            className="map-marker-warp"
            src={data.accessible ? greenWarpIcon : redWarpIcon}
            alt=""
            aria-hidden="true"
          />
        )}
      </button>
      <span id={`${id}-map-tooltip`} className="map-marker-tooltip" role="tooltip">
        {data.location.name}
      </span>
    </div>
  );
}

interface MapLocationMarkerProps {
  id: LocationFlowNode["id"];
  data: LocationNodeData;
  selected: boolean;
}

function MapLocationMarkerComponent({ id, data, selected }: MapLocationMarkerProps) {
  const markerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupSide, setPopupSide] = useState<PopupSide>("right");
  const { x, y, zoom } = useViewport();

  const updatePopupSide = useCallback(() => {
    if (!selected || !markerRef.current || !popupRef.current) return;
    const viewport = markerRef.current.closest(".map-viewport");
    if (!(viewport instanceof HTMLElement)) return;
    const viewportRect = viewport.getBoundingClientRect();
    popupRef.current.style.maxHeight = `${Math.max(1, (viewportRect.height - 24) / zoom)}px`;
    popupRef.current.style.maxWidth = `${Math.max(1, (viewportRect.width - 24) / zoom)}px`;

    const side = choosePopupSide(
      toScreenRect(markerRef.current.getBoundingClientRect()),
      toScreenRect(viewportRect),
      toScreenRect(popupRef.current.getBoundingClientRect()),
    );
    setPopupSide((current) => current === side ? current : side);
  }, [selected, zoom]);

  useLayoutEffect(updatePopupSide, [updatePopupSide, x, y, zoom]);

  useEffect(() => {
    if (!selected) return;
    const marker = markerRef.current;
    const popup = popupRef.current;
    const viewport = marker?.closest(".map-viewport");
    if (!marker || !popup || !(viewport instanceof HTMLElement)) return;

    const observer = new ResizeObserver(updatePopupSide);
    observer.observe(viewport);
    observer.observe(popup);
    window.addEventListener("resize", updatePopupSide);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updatePopupSide);
    };
  }, [selected, updatePopupSide]);

  const inverseZoomStyle = {
    "--map-marker-inverse-zoom": `${1 / zoom}`,
  } as CSSProperties;
  const popupOffset = getPopupOffsetForMarker(popupSide, zoom);

  return (
    <>
      <LocationMarkerButton
        id={id}
        data={data}
        selected={selected}
        onSelect={() => data.onSelectLocation?.(id)}
        buttonRef={markerRef}
        style={inverseZoomStyle}
      />

      <div className="map-marker-handle-layer" aria-hidden="true">
        {data.location.entrances.map((entrance) => (
          <Handle
            key={entrance.id}
            id={entrance.id}
            type={entrance.direction === "in" ? "target" : "source"}
            position={Position.Right}
            isConnectableStart={false}
            isConnectableEnd={false}
          />
        ))}
      </div>

      <NodeToolbar
        isVisible={selected}
        position={TOOLBAR_POSITION[popupSide]}
        offset={popupOffset}
        className="map-location-popup nodrag nopan nowheel"
        aria-label={`${data.location.name} location details`}
      >
        <div
          ref={popupRef}
          className="map-location-popup-frame"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: POPUP_TRANSFORM_ORIGIN[popupSide],
          }}
        >
          <button
            type="button"
            className="map-popup-close nodrag nopan"
            aria-label={`Close ${data.location.name} location details`}
            onClick={(event) => {
              event.stopPropagation();
              data.onClearSelection?.();
            }}
          >
            Close
          </button>
          <LocationCard id={id} data={data} selected />
        </div>
      </NodeToolbar>
    </>
  );
}

export const MapLocationMarker = memo(MapLocationMarkerComponent);
