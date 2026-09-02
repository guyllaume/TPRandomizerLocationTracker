import { describe, expect, it } from "vitest";
import {
  getNormalizedMapPosition,
  MAP_NATIVE_SIZE,
  preserveMapViewportOnResize,
  mapPositionToNativePoint,
  mapPositionToPoint,
  nativePointToMapPosition,
} from "./mapPosition";

describe("normalized map positions", () => {
  it("accepts the center and inclusive normalized edges", () => {
    expect(getNormalizedMapPosition({ x: 0.5, y: 0.5 })).toEqual({ x: 0.5, y: 0.5 });
    expect(getNormalizedMapPosition({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(getNormalizedMapPosition({ x: 1, y: 1 })).toEqual({ x: 1, y: 1 });
  });

  it("maps the normalized center to the center of rendered map bounds", () => {
    expect(mapPositionToPoint(
      { x: 0.5, y: 0.5 },
      { left: 100, top: 40, width: 800, height: 600 },
    )).toEqual({ x: 500, y: 340 });
  });

  it("maps normalized edge coordinates to rendered map edges", () => {
    const bounds = { left: 25, top: 50, width: 400, height: 700 };

    expect(mapPositionToPoint({ x: 0, y: 0 }, bounds)).toEqual({ x: 25, y: 50 });
    expect(mapPositionToPoint({ x: 1, y: 1 }, bounds)).toEqual({ x: 425, y: 750 });
  });

  it("converts a native cursor point back to normalized map coordinates", () => {
    const ordonSpring = nativePointToMapPosition({ x: 2219.6, y: 3835.608 });
    expect(ordonSpring?.x).toBeCloseTo(0.5549);
    expect(ordonSpring?.y).toBeCloseTo(0.8295);
    expect(nativePointToMapPosition({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(nativePointToMapPosition({
      x: MAP_NATIVE_SIZE.width,
      y: MAP_NATIVE_SIZE.height,
    })).toEqual({ x: 1, y: 1 });
  });

  it("does not report cursor coordinates outside the map image", () => {
    expect(nativePointToMapPosition({ x: -1, y: 100 })).toBeUndefined();
    expect(nativePointToMapPosition({ x: 100, y: MAP_NATIVE_SIZE.height + 1 })).toBeUndefined();
  });

  it("scales positions from the map bounds rather than fixed image pixels", () => {
    const position = { x: 0.25, y: 0.75 };

    expect(mapPositionToPoint(
      position,
      { left: 0, top: 0, width: 1000, height: 500 },
    )).toEqual({ x: 250, y: 375 });
    expect(mapPositionToPoint(
      position,
      { left: 0, top: 0, width: 400, height: 200 },
    )).toEqual({ x: 100, y: 150 });
  });

  it.each([0.25, 1, 2])(
    "keeps a normalized anchor aligned under a shared %sx scene transform",
    (zoom) => {
      const position = { x: 0.15, y: 0.93 };
      const pan = { x: -180, y: 75 };
      const scenePoint = mapPositionToNativePoint(position);
      const transformedNodePoint = {
        x: pan.x + scenePoint.x * zoom,
        y: pan.y + scenePoint.y * zoom,
      };
      const transformedMapPoint = mapPositionToPoint(position, {
        left: pan.x,
        top: pan.y,
        width: MAP_NATIVE_SIZE.width * zoom,
        height: MAP_NATIVE_SIZE.height * zoom,
      });

      expect(transformedNodePoint).toEqual(transformedMapPoint);
      expect(position).toEqual({ x: 0.15, y: 0.93 });
    },
  );

  it("preserves scene center and user zoom relative to the responsive baseline", () => {
    const resized = preserveMapViewportOnResize(
      { x: -300, y: -150, zoom: 1 },
      { width: 1200, height: 800 },
      0.5,
      { width: 800, height: 600 },
      0.3,
    );

    expect(resized).toEqual({ x: -140, y: -30, zoom: 0.6 });
    expect((800 / 2 - resized.x) / resized.zoom).toBe(900);
    expect((600 / 2 - resized.y) / resized.zoom).toBe(550);
  });

  it("rejects malformed and off-map values without throwing", () => {
    expect(getNormalizedMapPosition(undefined)).toBeUndefined();
    expect(getNormalizedMapPosition({ x: -0.01, y: 0.5 })).toBeUndefined();
    expect(getNormalizedMapPosition({ x: 0.5, y: 1.01 })).toBeUndefined();
    expect(getNormalizedMapPosition({ x: "0.5", y: 0.5 })).toBeUndefined();
    expect(getNormalizedMapPosition({ x: Number.NaN, y: 0.5 })).toBeUndefined();
  });
});
