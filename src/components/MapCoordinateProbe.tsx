import { Panel, useReactFlow } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { nativePointToMapPosition } from "../tracker/mapPosition";
import type { MapPosition } from "../types/tracker";

function formatCoordinate(position: MapPosition): string {
  return `{ "x": ${position.x.toFixed(4)}, "y": ${position.y.toFixed(4)} }`;
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

export function MapCoordinateProbe() {
  const [enabled, setEnabled] = useState(false);
  const [cursorPosition, setCursorPosition] = useState<MapPosition>();
  const [copyStatus, setCopyStatus] = useState("");
  const cursorPositionRef = useRef<MapPosition | undefined>(undefined);
  const toolRef = useRef<HTMLDivElement>(null);
  const flow = useReactFlow();

  const positionForPointer = useCallback((event: Pick<PointerEvent, "clientX" | "clientY">) =>
    nativePointToMapPosition(flow.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })), [flow]);

  const updateCursorPosition = useCallback((position: MapPosition | undefined) => {
    cursorPositionRef.current = position;
    setCursorPosition(position);
  }, []);

  const copyPosition = useCallback(async (position: MapPosition | undefined) => {
    if (!position) return;
    const text = formatCoordinate(position);
    setCopyStatus(await writeClipboard(text) ? `Copied ${text}` : "Clipboard copy failed");
  }, []);

  useEffect(() => {
    const viewport = toolRef.current?.closest(".map-viewport");
    if (!(viewport instanceof HTMLElement)) return;

    if (!enabled) {
      viewport.classList.remove("is-coordinate-probe-active");
      return;
    }

    let animationFrame = 0;
    const updatePosition = (event: PointerEvent) => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => {
        updateCursorPosition(positionForPointer(event));
      });
    };
    const copyClickedPosition = (event: MouseEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".map-coordinate-tool, .map-location-popup, .react-flow__controls, .react-flow__minimap")
      ) return;

      const position = positionForPointer(event);
      updateCursorPosition(position);
      void copyPosition(position);
    };
    const copyCurrentPosition = (event: KeyboardEvent) => {
      if (
        event.key.toLowerCase() !== "c" ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      ) return;

      event.preventDefault();
      void copyPosition(cursorPositionRef.current);
    };
    const clearPosition = () => updateCursorPosition(undefined);

    viewport.classList.add("is-coordinate-probe-active");
    viewport.addEventListener("pointermove", updatePosition);
    viewport.addEventListener("pointerleave", clearPosition);
    viewport.addEventListener("click", copyClickedPosition);
    window.addEventListener("keydown", copyCurrentPosition);
    return () => {
      cancelAnimationFrame(animationFrame);
      viewport.classList.remove("is-coordinate-probe-active");
      viewport.removeEventListener("pointermove", updatePosition);
      viewport.removeEventListener("pointerleave", clearPosition);
      viewport.removeEventListener("click", copyClickedPosition);
      window.removeEventListener("keydown", copyCurrentPosition);
    };
  }, [copyPosition, enabled, positionForPointer, updateCursorPosition]);

  return (
    <Panel position="top-left" className="map-coordinate-tool">
      <div ref={toolRef}>
        <button
          type="button"
          aria-pressed={enabled}
          onClick={() => {
            if (enabled) {
              updateCursorPosition(undefined);
              setCopyStatus("");
            }
            setEnabled((current) => !current);
          }}
        >
          {enabled ? "Hide coordinates" : "Show coordinates"}
        </button>
        {enabled && (
          <output aria-label="Normalized map cursor coordinates">
            <span>Normalized cursor</span>
            <code>{cursorPosition ? formatCoordinate(cursorPosition) : "Move over the map"}</code>
            <small>{copyStatus || "Left-click the map or press C to copy"}</small>
          </output>
        )}
      </div>
    </Panel>
  );
}
