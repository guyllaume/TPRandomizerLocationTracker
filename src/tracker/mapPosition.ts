import type { MapPosition, LocationDefinition } from "../types/tracker";

export const MAP_NATIVE_SIZE = {
  width: 4000,
  height: 4624,
} as const;

export const MAP_SCENE_BOUNDS = {
  x: 0,
  y: 0,
  ...MAP_NATIVE_SIZE,
} as const;

export const MAP_MIN_ZOOM = 0.25;
export const MAP_MAX_ZOOM = 2;
export const MAP_FIT_PADDING = 0.04;

export interface MapViewportTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface MapViewportSize {
  width: number;
  height: number;
}

export interface MapBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getNormalizedMapPosition(value: unknown): MapPosition | undefined {
  if (!value || typeof value !== "object") return undefined;

  const { x, y } = value as Record<string, unknown>;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    x > 1 ||
    y < 0 ||
    y > 1
  ) {
    return undefined;
  }

  return { x, y };
}

export function getLocationMapPosition(
  location: Pick<LocationDefinition, "mapPosition">,
): MapPosition | undefined {
  return getNormalizedMapPosition(location.mapPosition);
}

export function mapPositionToPoint(position: MapPosition, bounds: MapBounds): MapPosition {
  return {
    x: bounds.left + position.x * bounds.width,
    y: bounds.top + position.y * bounds.height,
  };
}

export function mapPositionToNativePoint(position: MapPosition): MapPosition {
  return mapPositionToPoint(position, {
    left: 0,
    top: 0,
    ...MAP_NATIVE_SIZE,
  });
}

export function nativePointToMapPosition(point: MapPosition): MapPosition | undefined {
  if (
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y) ||
    point.x < 0 ||
    point.x > MAP_NATIVE_SIZE.width ||
    point.y < 0 ||
    point.y > MAP_NATIVE_SIZE.height
  ) {
    return undefined;
  }

  return {
    x: point.x / MAP_NATIVE_SIZE.width,
    y: point.y / MAP_NATIVE_SIZE.height,
  };
}

export function preserveMapViewportOnResize(
  viewport: MapViewportTransform,
  previousSize: MapViewportSize,
  previousBaselineZoom: number,
  nextSize: MapViewportSize,
  nextBaselineZoom: number,
): MapViewportTransform {
  const sceneCenter = {
    x: (previousSize.width / 2 - viewport.x) / viewport.zoom,
    y: (previousSize.height / 2 - viewport.y) / viewport.zoom,
  };
  const relativeZoom = viewport.zoom / previousBaselineZoom;
  const zoom = Math.min(
    MAP_MAX_ZOOM,
    Math.max(MAP_MIN_ZOOM, nextBaselineZoom * relativeZoom),
  );

  return {
    x: nextSize.width / 2 - sceneCenter.x * zoom,
    y: nextSize.height / 2 - sceneCenter.y * zoom,
    zoom,
  };
}
