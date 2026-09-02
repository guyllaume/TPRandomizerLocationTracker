export type PopupSide = "right" | "left" | "top" | "bottom";

export interface ScreenRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const GAP = 12;

function overflowForSide(
  side: PopupSide,
  marker: ScreenRect,
  viewport: ScreenRect,
  popup: Pick<ScreenRect, "width" | "height">,
): number {
  const markerCenterX = marker.left + marker.width / 2;
  const markerCenterY = marker.top + marker.height / 2;
  const left = side === "right"
    ? marker.right + GAP
    : side === "left"
      ? marker.left - GAP - popup.width
      : markerCenterX - popup.width / 2;
  const top = side === "bottom"
    ? marker.bottom + GAP
    : side === "top"
      ? marker.top - GAP - popup.height
      : markerCenterY - popup.height / 2;

  return Math.max(0, viewport.left - left) +
    Math.max(0, left + popup.width - viewport.right) +
    Math.max(0, viewport.top - top) +
    Math.max(0, top + popup.height - viewport.bottom);
}

/** Prefer a side placement, then choose the candidate with the least clipping. */
export function choosePopupSide(
  marker: ScreenRect,
  viewport: ScreenRect,
  popup: Pick<ScreenRect, "width" | "height">,
): PopupSide {
  const sides: PopupSide[] = ["right", "left", "top", "bottom"];
  let best = sides[0];
  let bestOverflow = Number.POSITIVE_INFINITY;

  for (const side of sides) {
    const overflow = overflowForSide(side, marker, viewport, popup);
    if (overflow === 0) return side;
    if (overflow < bestOverflow) {
      best = side;
      bestOverflow = overflow;
    }
  }

  return best;
}

/** Keeps the toolbar gap tied to an inverse-scaled marker's visible edge. */
export function getPopupOffsetForMarker(side: PopupSide, zoom: number): number {
  const markerExtent = side === "left" || side === "right" ? 34 : 28;
  return GAP + markerExtent * (1 - zoom) / 2;
}
